import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {
    // MARK: - Types

    enum AuthorizationType {
        case always
        case whenInUse
        case none
    }

    private struct LocationRequest {
        let success: (GeolocationResponse) -> Void
        let error: ((GeolocationError) -> Void)?
        let options: ParsedOptions
        var timer: Timer?
    }

    private struct WatchSubscription {
        let success: (GeolocationResponse) -> Void
        let error: ((GeolocationError) -> Void)?
        let options: ParsedOptions
    }

    private struct ParsedOptions {
        let timeout: Double
        let maximumAge: Double
        let accuracy: CLLocationAccuracy
        let distanceFilter: CLLocationDistance
        let useSignificantChanges: Bool

        static func parse(from options: GeolocationOptions?) -> ParsedOptions {
            let timeout = options?.timeout ?? DEFAULT_TIMEOUT
            let maximumAge = options?.maximumAge ?? DEFAULT_MAXIMUM_AGE
            let enableHighAccuracy = options?.enableHighAccuracy ?? false
            let accuracy =
                enableHighAccuracy ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
            let distanceFilter = options?.distanceFilter ?? kCLDistanceFilterNone
            let useSignificantChanges = options?.useSignificantChanges ?? false

            return ParsedOptions(
                timeout: timeout,
                maximumAge: maximumAge,
                accuracy: accuracy,
                distanceFilter: distanceFilter,
                useSignificantChanges: useSignificantChanges
            )
        }
    }

    // MARK: - Properties

    private var locationManager: CLLocationManager?
    private var lastLocation: CLLocation?
    private var usingSignificantChanges: Bool = false

    // Authorization
    private var queuedAuthorizationCallbacks:
        [(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)] = []

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
        error: ((GeolocationError) -> Void)?
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.initializeLocationManagerIfNeeded()
            self.enqueueAuthorizationCallbacks(success: success, error: error)

            // Skip permission requests if configured
            if skipPermissionRequests {
                if enableBackgroundLocationUpdates {
                    self.enableBackgroundLocationUpdatesIfNeeded()
                }
                self.handleAuthorizationSuccess()
                return
            }

            // Check if already authorized
            let currentStatus = CLLocationManager.authorizationStatus()
            if currentStatus == .authorizedAlways || currentStatus == .authorizedWhenInUse {
                self.handleAuthorizationSuccess()
                return
            }

            if currentStatus == .denied || currentStatus == .restricted {
                self.handleAuthorizationError(for: currentStatus)
                return
            }

            // Not determined yet, request permission
            self.requestPermission(for: authType)
        }
    }

    private func enqueueAuthorizationCallbacks(
        success: (() -> Void)?, error: ((GeolocationError) -> Void)?
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
        success: @escaping (GeolocationResponse) -> Void,
        error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            let parsedOptions = ParsedOptions.parse(from: options)

            // Check authorization
            let status = CLLocationManager.authorizationStatus()
            if status == .denied || status == .restricted {
                let message =
                    status == .restricted
                    ? "This application is not authorized to use location services"
                    : "User denied access to location services."
                error?(self.createError(code: self.PERMISSION_DENIED, message: message))
                return
            }

            if !CLLocationManager.locationServicesEnabled() {
                error?(
                    self.createError(
                        code: self.POSITION_UNAVAILABLE, message: "Location services disabled."))
                return
            }

            // Check cached location
            if let cached = self.lastLocation,
                self.isCachedLocationValid(cached, options: parsedOptions)
            {
                success(self.locationToPosition(cached))
                return
            }

            self.initializeLocationManagerIfNeeded()

            // Configure location manager (use best accuracy from all pending requests)
            self.updateLocationManagerConfiguration()

            // Create request
            var request = LocationRequest(
                success: success,
                error: error,
                options: parsedOptions,
                timer: nil
            )

            // Setup timeout
            let timer = Timer.scheduledTimer(
                withTimeInterval: parsedOptions.timeout / 1000.0, repeats: false
            ) { [weak self] timer in
                self?.handleTimeout(for: timer)
            }
            request.timer = timer

            self.pendingRequests.append(request)

            // Start location updates
            self.startMonitoring()
        }
    }

    // MARK: - Watch Position

    func watchPosition(
        success: @escaping (GeolocationResponse) -> Void,
        error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) -> Double {
        var resultWatchId: Double = 0

        DispatchQueue.main.sync { [weak self] in
            guard let self = self else { return }

            let parsedOptions = ParsedOptions.parse(from: options)
            let watchId = self.nextWatchId
            self.nextWatchId += 1

            let subscription = WatchSubscription(
                success: success,
                error: error,
                options: parsedOptions
            )

            self.activeWatches[watchId] = subscription

            self.initializeLocationManagerIfNeeded()
            self.updateLocationManagerConfiguration()
            self.startMonitoring()

            resultWatchId = watchId
        }

        return resultWatchId
    }

    func clearWatch(watchId: Double) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.activeWatches.removeValue(forKey: watchId)

            // Stop monitoring if no more watches or pending requests
            if self.activeWatches.isEmpty && self.pendingRequests.isEmpty {
                self.stopMonitoring()
            }
        }
    }

    func stopObserving() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.activeWatches.removeAll()

            // Stop monitoring if no pending requests
            if self.pendingRequests.isEmpty {
                self.stopMonitoring()
            }
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
            request.timer?.invalidate()
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
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let geoError: GeolocationError

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
            request.timer?.invalidate()
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
        locationManager = CLLocationManager()
        locationManager?.delegate = self
    }

    private func updateLocationManagerConfiguration() {
        guard let manager = locationManager else { return }

        // Find the best (most accurate) settings from all pending requests and active watches
        var bestAccuracy = kCLLocationAccuracyHundredMeters
        var smallestDistanceFilter = kCLDistanceFilterNone
        var shouldUseSignificantChanges = false

        for request in pendingRequests {
            bestAccuracy = min(bestAccuracy, request.options.accuracy)
            smallestDistanceFilter = min(smallestDistanceFilter, request.options.distanceFilter)
            shouldUseSignificantChanges =
                shouldUseSignificantChanges || request.options.useSignificantChanges
        }

        for (_, watch) in activeWatches {
            bestAccuracy = min(bestAccuracy, watch.options.accuracy)
            smallestDistanceFilter = min(smallestDistanceFilter, watch.options.distanceFilter)
            shouldUseSignificantChanges =
                shouldUseSignificantChanges || watch.options.useSignificantChanges
        }

        manager.desiredAccuracy = bestAccuracy
        manager.distanceFilter = smallestDistanceFilter

        // Update significant changes mode if changed
        if shouldUseSignificantChanges != usingSignificantChanges {
            stopMonitoring()
            usingSignificantChanges = shouldUseSignificantChanges
            startMonitoring()
        }
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

    private func isCachedLocationValid(_ location: CLLocation, options: ParsedOptions) -> Bool {
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

    private func handleTimeout(for timer: Timer) {
        // Find and remove the request with this timer
        if let index = pendingRequests.firstIndex(where: { $0.timer === timer }) {
            let request = pendingRequests[index]
            pendingRequests.remove(at: index)

            // Always return timeout error
            let timeoutSeconds = request.options.timeout / 1000.0
            let message = String(format: "Unable to fetch location within %.1fs.", timeoutSeconds)
            request.error?(createError(code: TIMEOUT, message: message))

            // Stop monitoring if no more watches or pending requests
            if activeWatches.isEmpty && pendingRequests.isEmpty {
                stopMonitoring()
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

    private func createGeolocationError(for status: CLAuthorizationStatus) -> GeolocationError {
        let message =
            status == .restricted
            ? "This application is not authorized to use location services"
            : "User denied access to location services."

        return GeolocationError(
            code: Double(PERMISSION_DENIED),
            message: message,
            PERMISSION_DENIED: Double(PERMISSION_DENIED),
            POSITION_UNAVAILABLE: Double(POSITION_UNAVAILABLE),
            TIMEOUT: Double(TIMEOUT)
        )
    }

    private func invokeQueuedAuthorizationCallbacks(
        success: Bool = false, error: GeolocationError? = nil
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

    private func locationToPosition(_ location: CLLocation) -> GeolocationResponse {
        let altitude = location.verticalAccuracy < 0 ? 0.0 : location.altitude
        let altitudeAccuracy = location.verticalAccuracy < 0 ? 0.0 : location.verticalAccuracy
        let heading = location.course >= 0 ? location.course : -1.0
        let speed = location.speed >= 0 ? location.speed : 0.0

        let coordsObj = GeolocationCoordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            altitude: altitude,
            accuracy: location.horizontalAccuracy,
            altitudeAccuracy: altitudeAccuracy,
            heading: heading,
            speed: speed
        )

        let position = GeolocationResponse(
            coords: coordsObj,
            timestamp: location.timestamp.timeIntervalSince1970 * 1000
        )

        return position
    }

    private func createError(code: Int, message: String) -> GeolocationError {
        return GeolocationError(
            code: Double(code),
            message: message,
            PERMISSION_DENIED: Double(PERMISSION_DENIED),
            POSITION_UNAVAILABLE: Double(POSITION_UNAVAILABLE),
            TIMEOUT: Double(TIMEOUT)
        )
    }
}
