import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {
    // MARK: - Types

    enum AuthorizationType {
        case always
        case whenInUse
        case none
    }

    private struct LocationRequest {
        let id: UUID = UUID()
        let success: (CompatGeolocationResponse) -> Void
        let error: ((CompatGeolocationError) -> Void)?
        let options: ParsedOptions
        var timer: DispatchSourceTimer?
    }

    private struct WatchSubscription {
        let success: (CompatGeolocationResponse) -> Void
        let error: ((CompatGeolocationError) -> Void)?
        let options: ParsedOptions
    }

    struct ParsedOptions {
        let timeout: Double
        let maximumAge: Double
        let accuracy: CLLocationAccuracy
        let distanceFilter: CLLocationDistance
        let useSignificantChanges: Bool
        let activityType: CLActivityType?
        let pausesLocationUpdatesAutomatically: Bool?
        let showsBackgroundLocationIndicator: Bool?

        static func parse(from options: CompatGeolocationOptions?) -> ParsedOptions {
            let timeout = options?.timeout ?? DEFAULT_TIMEOUT
            let maximumAge = options?.maximumAge ?? DEFAULT_MAXIMUM_AGE
            let enableHighAccuracy = options?.enableHighAccuracy ?? false
            let accuracy = resolveAccuracy(
                preset: options?.accuracy?.ios,
                enableHighAccuracy: enableHighAccuracy
            )
            let distanceFilter = options?.distanceFilter ?? kCLDistanceFilterNone
            let useSignificantChanges = options?.useSignificantChanges ?? false

            return ParsedOptions(
                timeout: timeout,
                maximumAge: maximumAge,
                accuracy: accuracy,
                distanceFilter: distanceFilter,
                useSignificantChanges: useSignificantChanges,
                activityType: resolveActivityType(options?.activityType),
                pausesLocationUpdatesAutomatically: options?.pausesLocationUpdatesAutomatically,
                showsBackgroundLocationIndicator: options?.showsBackgroundLocationIndicator
            )
        }

        private static func resolveAccuracy(
            preset: IOSAccuracyPreset?,
            enableHighAccuracy: Bool
        ) -> CLLocationAccuracy {
            guard let preset else {
                return enableHighAccuracy
                    ? kCLLocationAccuracyBest
                    : kCLLocationAccuracyHundredMeters
            }

            switch preset {
            case .bestfornavigation:
                return kCLLocationAccuracyBestForNavigation
            case .best:
                return kCLLocationAccuracyBest
            case .nearesttenmeters:
                return kCLLocationAccuracyNearestTenMeters
            case .hundredmeters:
                return kCLLocationAccuracyHundredMeters
            case .kilometer:
                return kCLLocationAccuracyKilometer
            case .threekilometers:
                return kCLLocationAccuracyThreeKilometers
            case .reduced:
                return kCLLocationAccuracyReduced
            }
        }

        private static func resolveActivityType(_ activityType: IOSActivityType?) -> CLActivityType? {
            guard let activityType else {
                return nil
            }

            switch activityType {
            case .other:
                return .other
            case .automotivenavigation:
                return .automotiveNavigation
            case .fitness:
                return .fitness
            case .othernavigation:
                return .otherNavigation
            case .airborne:
                return .airborne
            }
        }
    }

    // MARK: - Properties

    private var locationManager: CLLocationManager?
    internal private(set) var lastLocation: CLLocation?
    private var usingSignificantChanges: Bool = false

    // Authorization
    private var queuedAuthorizationCallbacks:
        [(success: (() -> Void)?, error: ((CompatGeolocationError) -> Void)?)] = []

    // getCurrentPosition
    private var pendingRequests: [LocationRequest] = []

    // watchPosition
    private var activeWatches: [Double: WatchSubscription] = [:]
    private var nextWatchId: Double = 1

    // Error codes
    private let PERMISSION_DENIED = 1
    private let POSITION_UNAVAILABLE = 2
    private let TIMEOUT = 3

    // MARK: - Constants

    private static let DEFAULT_TIMEOUT: Double = 10 * 60 * 1000  // 10 minutes in ms
    private static let DEFAULT_MAXIMUM_AGE: Double = Double.infinity

    // MARK: - Authorization

    func requestAuthorization(
        authType: AuthorizationType,
        skipPermissionRequests: Bool,
        enableBackgroundLocationUpdates: Bool,
        success: (() -> Void)?,
        error: ((CompatGeolocationError) -> Void)?
    ) {
        initializeLocationManagerIfNeeded()
        enqueueAuthorizationCallbacks(success: success, error: error)

        // Skip permission requests if configured
        if skipPermissionRequests {
            if enableBackgroundLocationUpdates {
                enableBackgroundLocationUpdatesIfNeeded()
            }
            handleAuthorizationSuccess()
            return
        }

        // Check if already authorized
        let currentStatus = CLLocationManager.authorizationStatus()
        if currentStatus == .authorizedAlways || currentStatus == .authorizedWhenInUse {
            handleAuthorizationSuccess()
            return
        }

        if currentStatus == .denied || currentStatus == .restricted {
            handleAuthorizationError(for: currentStatus)
            return
        }

        // Not determined yet, request permission
        requestPermission(for: authType)
    }

    private func enqueueAuthorizationCallbacks(
        success: (() -> Void)?, error: ((CompatGeolocationError) -> Void)?
    ) {
        guard success != nil || error != nil else { return }
        queuedAuthorizationCallbacks.append((success: success, error: error))
    }

    private func requestPermission(for type: AuthorizationType) {
        switch type {
        case .always:
            locationManager?.requestAlwaysAuthorization()
            enableBackgroundLocationUpdatesIfNeeded()
        case .whenInUse:
            locationManager?.requestWhenInUseAuthorization()
        case .none:
            break
        }
    }

    private func enableBackgroundLocationUpdatesIfNeeded() {
        guard
            let backgroundModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes")
                as? [String],
            backgroundModes.contains("location")
        else {
            return
        }
        locationManager?.allowsBackgroundLocationUpdates = true
    }

    // MARK: - Get Current Position

    func getCurrentPosition(
        success: @escaping (CompatGeolocationResponse) -> Void,
        error: ((CompatGeolocationError) -> Void)?,
        options: CompatGeolocationOptions?
    ) {
        let parsedOptions = ParsedOptions.parse(from: options)

        // Check authorization
        let status = CLLocationManager.authorizationStatus()
        if status == .denied || status == .restricted {
            let message =
                status == .restricted
                ? "This application is not authorized to use location services"
                : "User denied access to location services."
            error?(createError(code: PERMISSION_DENIED, message: message))
            return
        }

        if !CLLocationManager.locationServicesEnabled() {
            error?(createError(code: POSITION_UNAVAILABLE, message: "Location services disabled."))
            return
        }

        initializeLocationManagerIfNeeded()

        // Create request
        var request = LocationRequest(
            success: success,
            error: error,
            options: parsedOptions,
            timer: nil
        )

        // Setup timeout with DispatchSourceTimer (no run loop needed)
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + parsedOptions.timeout / 1000.0)
        timer.setEventHandler { [weak self] in
            self?.handleTimeout(for: request.id)
        }
        timer.resume()
        request.timer = timer

        pendingRequests.append(request)

        // Update configuration and start location updates
        updateLocationManagerConfiguration()
        startMonitoring()
    }

    // MARK: - Watch Position

    func watchPosition(
        success: @escaping (CompatGeolocationResponse) -> Void,
        error: ((CompatGeolocationError) -> Void)?,
        options: CompatGeolocationOptions?
    ) -> Double {
        let parsedOptions = ParsedOptions.parse(from: options)
        let watchId = nextWatchId
        nextWatchId += 1

        let subscription = WatchSubscription(
            success: success,
            error: error,
            options: parsedOptions
        )

        activeWatches[watchId] = subscription

        initializeLocationManagerIfNeeded()

        updateLocationManagerConfiguration()
        startMonitoring()

        return watchId
    }

    func clearWatch(watchId: Double) {
        activeWatches.removeValue(forKey: watchId)

        // Stop monitoring if no more watches or pending requests
        if activeWatches.isEmpty && pendingRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }
    }

    func stopObserving() {
        activeWatches.removeAll()

        // Stop monitoring if no pending requests
        if pendingRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = getCurrentAuthorizationStatus(from: manager)

        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            handleAuthorizationSuccess()
            startMonitoring()
        case .denied, .restricted:
            handleAuthorizationError(for: status)
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        lastLocation = location
        let position = locationToPosition(location)

        // 1. Fire all pending getCurrentPosition requests
        for request in pendingRequests {
            request.timer?.cancel()
            request.success(position)
        }
        pendingRequests.removeAll()

        // 2. Fire all active watchPosition subscriptions
        for (_, watch) in activeWatches {
            watch.success(position)
        }

        // 3. Stop monitoring if no more watches or pending requests
        if activeWatches.isEmpty && pendingRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let geoError: CompatGeolocationError

        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                geoError = createError(
                    code: PERMISSION_DENIED, message: "User denied access to location services.")
            case .locationUnknown:
                // Location is temporarily unavailable, keep trying
                return
            default:
                geoError = createError(
                    code: POSITION_UNAVAILABLE,
                    message: "Unable to retrieve location: \(error.localizedDescription)")
            }
        } else {
            geoError = createError(
                code: POSITION_UNAVAILABLE,
                message: "Unable to retrieve location: \(error.localizedDescription)")
        }

        // Fire all pending requests with error
        for request in pendingRequests {
            request.timer?.cancel()
            request.error?(geoError)
        }
        pendingRequests.removeAll()

        // Fire all active watches with error
        for (_, watch) in activeWatches {
            watch.error?(geoError)
        }

        stopMonitoring()
    }

    // MARK: - Helper Functions

    private func initializeLocationManagerIfNeeded() {
        guard locationManager == nil else { return }

        // CLLocationManager must be created on main thread for delegate callbacks
        if Thread.isMainThread {
            locationManager = CLLocationManager()
            locationManager?.delegate = self
        } else {
            DispatchQueue.main.sync {
                locationManager = CLLocationManager()
                locationManager?.delegate = self
            }
        }
    }

    private func updateLocationManagerConfiguration() {
        guard let manager = locationManager else { return }

        // Find the best (most accurate) settings from all pending requests and active watches
        var bestAccuracy: CLLocationAccuracy?
        var smallestDistanceFilter: CLLocationDistance?
        var activityType: CLActivityType?
        var pausesLocationUpdatesAutomatically: Bool?
        var showsBackgroundLocationIndicator = false
        var shouldUseSignificantChanges = false

        for request in pendingRequests {
            bestAccuracy = mergeAccuracy(bestAccuracy, request.options.accuracy)
            smallestDistanceFilter = mergeDistanceFilter(
                smallestDistanceFilter,
                request.options.distanceFilter
            )
            activityType = mergeActivityType(activityType, request.options.activityType)
            pausesLocationUpdatesAutomatically = mergePausesLocationUpdatesAutomatically(
                pausesLocationUpdatesAutomatically,
                request.options.pausesLocationUpdatesAutomatically
            )
            showsBackgroundLocationIndicator = showsBackgroundLocationIndicator ||
                (request.options.showsBackgroundLocationIndicator ?? false)
            shouldUseSignificantChanges =
                shouldUseSignificantChanges || request.options.useSignificantChanges
        }

        for (_, watch) in activeWatches {
            bestAccuracy = mergeAccuracy(bestAccuracy, watch.options.accuracy)
            smallestDistanceFilter = mergeDistanceFilter(
                smallestDistanceFilter,
                watch.options.distanceFilter
            )
            activityType = mergeActivityType(activityType, watch.options.activityType)
            pausesLocationUpdatesAutomatically = mergePausesLocationUpdatesAutomatically(
                pausesLocationUpdatesAutomatically,
                watch.options.pausesLocationUpdatesAutomatically
            )
            showsBackgroundLocationIndicator = showsBackgroundLocationIndicator ||
                (watch.options.showsBackgroundLocationIndicator ?? false)
            shouldUseSignificantChanges =
                shouldUseSignificantChanges || watch.options.useSignificantChanges
        }

        manager.desiredAccuracy = bestAccuracy ?? kCLLocationAccuracyHundredMeters
        manager.distanceFilter = smallestDistanceFilter ?? kCLDistanceFilterNone
        manager.activityType = activityType ?? .other
        manager.pausesLocationUpdatesAutomatically = pausesLocationUpdatesAutomatically ?? true

        if #available(iOS 11.0, *) {
            manager.showsBackgroundLocationIndicator = showsBackgroundLocationIndicator
        }

        // Update significant changes mode if changed
        if shouldUseSignificantChanges != usingSignificantChanges {
            stopMonitoring()
            usingSignificantChanges = shouldUseSignificantChanges
            startMonitoring()
        }
    }

    private func mergeAccuracy(
        _ current: CLLocationAccuracy?,
        _ next: CLLocationAccuracy
    ) -> CLLocationAccuracy {
        guard let current else {
            return next
        }

        return min(current, next)
    }

    private func mergeActivityType(
        _ current: CLActivityType?,
        _ next: CLActivityType?
    ) -> CLActivityType? {
        guard let next else {
            return current
        }

        guard let current else {
            return next
        }

        return activityTypeRank(next) > activityTypeRank(current) ? next : current
    }

    private func activityTypeRank(_ activityType: CLActivityType) -> Int {
        switch activityType {
        case .other:
            return 0
        case .otherNavigation:
            return 1
        case .automotiveNavigation:
            return 2
        case .fitness:
            return 3
        case .airborne:
            return 4
        @unknown default:
            return 0
        }
    }

    private func mergePausesLocationUpdatesAutomatically(
        _ current: Bool?,
        _ next: Bool?
    ) -> Bool? {
        guard let next else {
            return current
        }

        guard let current else {
            return next
        }

        return current && next
    }

    private func mergeDistanceFilter(
        _ current: CLLocationDistance?,
        _ next: CLLocationDistance
    ) -> CLLocationDistance {
        guard let current else {
            return next
        }

        if current == kCLDistanceFilterNone || next == kCLDistanceFilterNone {
            return kCLDistanceFilterNone
        }

        return min(current, next)
    }

    private func startMonitoring() {
        if usingSignificantChanges {
            locationManager?.startMonitoringSignificantLocationChanges()
        } else {
            locationManager?.startUpdatingLocation()
        }
    }

    private func stopMonitoring() {
        if usingSignificantChanges {
            locationManager?.stopMonitoringSignificantLocationChanges()
        } else {
            locationManager?.stopUpdatingLocation()
        }
    }

    func isCachedLocationValid(_ location: CLLocation, options: ParsedOptions) -> Bool {
        // Check if maximumAge is infinity
        if options.maximumAge.isInfinite {
            return true
        }

        // Check age
        let age = Date().timeIntervalSince(location.timestamp) * 1000  // convert to ms
        guard age < options.maximumAge else {
            return false
        }

        // Check accuracy
        guard location.horizontalAccuracy <= options.accuracy else {
            return false
        }

        return true
    }

    private func handleTimeout(for requestId: UUID) {
        // Find and remove the request with this ID
        if let index = pendingRequests.firstIndex(where: { $0.id == requestId }) {
            let request = pendingRequests[index]
            pendingRequests.remove(at: index)

            // Cancel timer
            request.timer?.cancel()

            // Return timeout error
            let timeoutSeconds = request.options.timeout / 1000.0
            let message = String(format: "Unable to fetch location within %.1fs.", timeoutSeconds)
            request.error?(createError(code: TIMEOUT, message: message))

            // Stop monitoring if no more watches or pending requests
            if activeWatches.isEmpty && pendingRequests.isEmpty {
                stopMonitoring()
            } else {
                updateLocationManagerConfiguration()
            }
        }
    }

    private func getCurrentAuthorizationStatus(from manager: CLLocationManager)
        -> CLAuthorizationStatus
    {
        if #available(iOS 14.0, *) {
            return manager.authorizationStatus
        } else {
            return CLLocationManager.authorizationStatus()
        }
    }

    private func handleAuthorizationSuccess() {
        invokeQueuedAuthorizationCallbacks(success: true)
    }

    private func handleAuthorizationError(for status: CLAuthorizationStatus) {
        let error = createGeolocationError(for: status)
        invokeQueuedAuthorizationCallbacks(error: error)
    }

    private func createGeolocationError(for status: CLAuthorizationStatus) -> CompatGeolocationError {
        let message =
            status == .restricted
            ? "This application is not authorized to use location services"
            : "User denied access to location services."

        return CompatGeolocationError(
            code: Double(PERMISSION_DENIED),
            message: message,
            PERMISSION_DENIED: Double(PERMISSION_DENIED),
            POSITION_UNAVAILABLE: Double(POSITION_UNAVAILABLE),
            TIMEOUT: Double(TIMEOUT)
        )
    }

    private func invokeQueuedAuthorizationCallbacks(
        success: Bool = false, error: CompatGeolocationError? = nil
    ) {
        for callback in queuedAuthorizationCallbacks {
            if success {
                callback.success?()
            } else if let error = error {
                callback.error?(error)
            }
        }
        queuedAuthorizationCallbacks.removeAll()
    }

    func locationToPosition(_ location: CLLocation) -> CompatGeolocationResponse {
        let coordsObj = GeolocationCoordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            altitude: location.nitroGeolocationAltitude,
            accuracy: location.horizontalAccuracy,
            altitudeAccuracy: location.nitroGeolocationAltitudeAccuracy,
            heading: location.nitroGeolocationHeading,
            speed: location.nitroGeolocationSpeed
        )

        let position = CompatGeolocationResponse(
            coords: coordsObj,
            timestamp: location.timestamp.timeIntervalSince1970 * 1000
        )

        return position
    }

    private func createError(code: Int, message: String) -> CompatGeolocationError {
        return CompatGeolocationError(
            code: Double(code),
            message: message,
            PERMISSION_DENIED: Double(PERMISSION_DENIED),
            POSITION_UNAVAILABLE: Double(POSITION_UNAVAILABLE),
            TIMEOUT: Double(TIMEOUT)
        )
    }
}
