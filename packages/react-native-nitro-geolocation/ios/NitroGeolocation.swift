import Foundation
import CoreLocation
import NitroModules

/**
 * Swift Error wrapper for LocationError struct.
 */
private struct GeolocationErrorWrapper: Error {
    let locationError: LocationError

    init(code: Int, message: String) {
        self.locationError = LocationError(
            code: Double(code),
            message: message
        )
    }
}

/**
 * Modern Geolocation implementation with Promise-based API.
 *
 * Key features:
 * - Promise-based permission and getCurrentPosition
 * - Token-based watch subscriptions (functions are first-class!)
 * - WatchPositionResult discriminated union
 * - Automatic subscription management
 */
class NitroGeolocation: HybridNitroGeolocationSpec {
    // MARK: - Types

    private struct ParsedOptions {
        let timeout: Double
        let maximumAge: Double
        let accuracy: CLLocationAccuracy
        let distanceFilter: CLLocationDistance
        let useSignificantChanges: Bool

        static let DEFAULT_TIMEOUT: Double = 10 * 60 * 1000  // 10 minutes in ms
        static let DEFAULT_MAXIMUM_AGE: Double = 0

        static func parse(from options: LocationRequestOptions?) -> ParsedOptions {
            let timeout = options?.timeout ?? DEFAULT_TIMEOUT
            let maximumAge = options?.maximumAge ?? DEFAULT_MAXIMUM_AGE
            let enableHighAccuracy = options?.enableHighAccuracy ?? false
            let accuracy = enableHighAccuracy
                ? kCLLocationAccuracyBest
                : kCLLocationAccuracyHundredMeters
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

    // Watch subscription storage (first-class functions!)
    private struct WatchSubscription {
        let token: String
        let success: (GeolocationResponse) -> Void
        let error: ((LocationError) -> Void)?
        let options: ParsedOptions
    }

    // MARK: - Properties

    private var configuration: ModernGeolocationConfiguration?
    private var locationManager: CLLocationManager?
    private var lastLocation: CLLocation?
    private var usingSignificantChanges: Bool = false

    // Permission promise resolvers
    private var pendingPermissionResolvers: [(Result<PermissionStatus, Error>) -> Void] = []

    // getCurrentPosition promise resolvers with timeout
    private var pendingPositionRequests: [UUID: PositionRequest] = [:]

    private struct PositionRequest {
        let id: UUID
        let resolver: (Result<GeolocationResponse, Error>) -> Void
        let options: ParsedOptions
        var timer: DispatchSourceTimer?
    }

    // Watch subscriptions (token -> callback)
    private var watchSubscriptions: [String: WatchSubscription] = [:]

    // Error codes
    private let PERMISSION_DENIED = 1
    private let POSITION_UNAVAILABLE = 2
    private let TIMEOUT = 3

    // MARK: - Configuration

    func setConfiguration(config: ModernGeolocationConfiguration) {
        self.configuration = config
    }

    // MARK: - Permission API (Promise-based)

    func checkPermission() throws -> Promise<PermissionStatus> {
        return Promise.async {
            let status = CLLocationManager.authorizationStatus()
            return self.mapCLAuthorizationStatus(status)
        }
    }

    func requestPermission() throws -> Promise<PermissionStatus> {
        let promise = Promise<PermissionStatus>()

        self.initializeLocationManagerIfNeeded()

        let currentStatus = CLLocationManager.authorizationStatus()

        // Already determined
        if currentStatus != .notDetermined {
            let status = self.mapCLAuthorizationStatus(currentStatus)
            promise.resolve(withResult: status)
            return promise
        }

        // Queue resolver
        self.pendingPermissionResolvers.append { result in
            switch result {
            case .success(let status):
                promise.resolve(withResult: status)
            case .failure(let error):
                promise.reject(withError: error)
            }
        }

        // Request permission
        let authLevel = self.determineAuthorizationLevel()
        self.requestSystemPermission(for: authLevel)

        return promise
    }

    // MARK: - Get Current Position (Promise-based)

    func getCurrentPosition(options: LocationRequestOptions?) throws -> Promise<GeolocationResponse> {
        let promise = Promise<GeolocationResponse>()

        // Check permission
        let status = CLLocationManager.authorizationStatus()
        if status == .denied || status == .restricted {
            let message = status == .restricted
                ? "This application is not authorized to use location services"
                : "User denied access to location services."
            let error = GeolocationErrorWrapper(
                code: self.PERMISSION_DENIED,
                message: message
            )
            promise.reject(withError: error)
            return promise
        }

        if !CLLocationManager.locationServicesEnabled() {
            let error = GeolocationErrorWrapper(
                code: self.POSITION_UNAVAILABLE,
                message: "Location services disabled."
            )
            promise.reject(withError: error)
            return promise
        }

        self.initializeLocationManagerIfNeeded()

        let parsedOptions = ParsedOptions.parse(from: options)

        // Check cached location
        if let cached = self.lastLocation,
           self.isCachedLocationValid(cached, options: parsedOptions) {
            let position = self.locationToPosition(cached)
            promise.resolve(withResult: position)
            return promise
        }

        // Create position request
        let id = UUID()
        var request = PositionRequest(
            id: id,
            resolver: { result in
                switch result {
                case .success(let response):
                    promise.resolve(withResult: response)
                case .failure(let error):
                    promise.reject(withError: error)
                }
            },
            options: parsedOptions,
            timer: nil
        )

        // Setup timeout
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + parsedOptions.timeout / 1000.0)
        timer.setEventHandler { [weak self] in
            self?.handlePositionTimeout(requestId: id)
        }
        timer.resume()
        request.timer = timer

        self.pendingPositionRequests[id] = request

        // Update configuration and start monitoring
        self.updateLocationManagerConfiguration()
        self.startMonitoring()

        return promise
    }

    // MARK: - Watch Position (Callback-based with tokens)

    func watchPosition(
        success: @escaping (GeolocationResponse) -> Void,
        error: ((LocationError) -> Void)?,
        options: LocationRequestOptions?
    ) -> String {
        let token = UUID().uuidString
        let parsedOptions = ParsedOptions.parse(from: options)

        let subscription = WatchSubscription(
            token: token,
            success: success,
            error: error,
            options: parsedOptions
        )

        watchSubscriptions[token] = subscription

        initializeLocationManagerIfNeeded()
        updateLocationManagerConfiguration()
        startMonitoring()

        return token
    }

    func unwatch(token: String) {
        watchSubscriptions.removeValue(forKey: token)

        // Stop monitoring if no more subscriptions or pending requests
        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        }
    }

    func stopObserving() {
        watchSubscriptions.removeAll()

        // Stop monitoring if no pending requests
        if pendingPositionRequests.isEmpty {
            stopMonitoring()
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = getCurrentAuthorizationStatus(from: manager)
        let mappedStatus = mapCLAuthorizationStatus(status)

        // Resolve pending permission requests
        for resolver in pendingPermissionResolvers {
            resolver(.success(mappedStatus))
        }
        pendingPermissionResolvers.removeAll()

        // If authorized, start monitoring
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            if !pendingPositionRequests.isEmpty || !watchSubscriptions.isEmpty {
                startMonitoring()
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        lastLocation = location
        let position = locationToPosition(location)

        // 1. Resolve all pending getCurrentPosition requests
        for (id, request) in pendingPositionRequests {
            request.timer?.cancel()
            request.resolver(.success(position))
        }
        pendingPositionRequests.removeAll()

        // 2. Notify all watch subscriptions (success)
        for (_, subscription) in watchSubscriptions {
            subscription.success(position)
        }

        // 3. Stop monitoring if no more subscriptions or pending requests
        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let locationError: LocationError
        let errorWrapper: GeolocationErrorWrapper

        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                locationError = createLocationError(
                    code: PERMISSION_DENIED,
                    message: "User denied access to location services."
                )
                errorWrapper = GeolocationErrorWrapper(
                    code: PERMISSION_DENIED,
                    message: "User denied access to location services."
                )
            case .locationUnknown:
                // Temporarily unavailable, keep trying
                return
            default:
                locationError = createLocationError(
                    code: POSITION_UNAVAILABLE,
                    message: "Unable to retrieve location: \(error.localizedDescription)"
                )
                errorWrapper = GeolocationErrorWrapper(
                    code: POSITION_UNAVAILABLE,
                    message: "Unable to retrieve location: \(error.localizedDescription)"
                )
            }
        } else {
            locationError = createLocationError(
                code: POSITION_UNAVAILABLE,
                message: "Unable to retrieve location: \(error.localizedDescription)"
            )
            errorWrapper = GeolocationErrorWrapper(
                code: POSITION_UNAVAILABLE,
                message: "Unable to retrieve location: \(error.localizedDescription)"
            )
        }

        // 1. Reject all pending getCurrentPosition requests
        for (_, request) in pendingPositionRequests {
            request.timer?.cancel()
            request.resolver(.failure(errorWrapper))
        }
        pendingPositionRequests.removeAll()

        // 2. Notify all watch subscriptions (error)
        for (_, subscription) in watchSubscriptions {
            subscription.error?(locationError)
        }

        stopMonitoring()
    }

    // MARK: - Helper Functions

    private func initializeLocationManagerIfNeeded() {
        guard locationManager == nil else { return }

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

        // Merge configurations from all pending requests and watches
        var bestAccuracy = kCLLocationAccuracyHundredMeters
        var smallestDistanceFilter = kCLDistanceFilterNone
        var shouldUseSignificantChanges = false

        for (_, request) in pendingPositionRequests {
            bestAccuracy = min(bestAccuracy, request.options.accuracy)
            smallestDistanceFilter = min(smallestDistanceFilter, request.options.distanceFilter)
            shouldUseSignificantChanges = shouldUseSignificantChanges || request.options.useSignificantChanges
        }

        for (_, subscription) in watchSubscriptions {
            bestAccuracy = min(bestAccuracy, subscription.options.accuracy)
            smallestDistanceFilter = min(smallestDistanceFilter, subscription.options.distanceFilter)
            shouldUseSignificantChanges = shouldUseSignificantChanges || subscription.options.useSignificantChanges
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
        // maximumAge is infinity
        if options.maximumAge.isInfinite {
            return true
        }

        // Check age
        let age = Date().timeIntervalSince(location.timestamp) * 1000  // ms
        return age < options.maximumAge
    }

    private func handlePositionTimeout(requestId: UUID) {
        guard let request = pendingPositionRequests.removeValue(forKey: requestId) else {
            return
        }

        request.timer?.cancel()

        let timeoutSeconds = request.options.timeout / 1000.0
        let message = String(format: "Unable to fetch location within %.1fs.", timeoutSeconds)
        let error = GeolocationErrorWrapper(code: TIMEOUT, message: message)

        request.resolver(.failure(error))

        // Stop monitoring if no more watches or pending requests
        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        }
    }

    private func determineAuthorizationLevel() -> AuthorizationLevel {
        if let config = configuration,
           let authLevel = config.authorizationLevel {
            return authLevel
        }

        // Auto-detect from Info.plist
        return determineAuthorizationLevelFromInfoPlist()
    }

    private func determineAuthorizationLevelFromInfoPlist() -> AuthorizationLevel {
        let hasAlwaysKey = Bundle.main.object(forInfoDictionaryKey: "NSLocationAlwaysAndWhenInUseUsageDescription") != nil
        let hasWhenInUseKey = Bundle.main.object(forInfoDictionaryKey: "NSLocationWhenInUseUsageDescription") != nil

        if hasAlwaysKey && hasWhenInUseKey {
            return .always
        } else if hasWhenInUseKey {
            return .wheninuse
        }

        return .wheninuse  // Default
    }

    private func requestSystemPermission(for type: AuthorizationLevel) {
        switch type {
        case .always:
            locationManager?.requestAlwaysAuthorization()
            if configuration?.enableBackgroundLocationUpdates == true {
                enableBackgroundLocationUpdatesIfNeeded()
            }
        case .wheninuse:
            locationManager?.requestWhenInUseAuthorization()
        case .auto:
            let detected = determineAuthorizationLevelFromInfoPlist()
            requestSystemPermission(for: detected)
        }
    }

    private func enableBackgroundLocationUpdatesIfNeeded() {
        guard let backgroundModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String],
              backgroundModes.contains("location") else {
            return
        }
        locationManager?.allowsBackgroundLocationUpdates = true
    }

    private func getCurrentAuthorizationStatus(from manager: CLLocationManager) -> CLAuthorizationStatus {
        if #available(iOS 14.0, *) {
            return manager.authorizationStatus
        } else {
            return CLLocationManager.authorizationStatus()
        }
    }

    private func mapCLAuthorizationStatus(_ status: CLAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            return .granted
        case .denied:
            return .denied
        case .restricted:
            return .restricted
        case .notDetermined:
            return .undetermined
        @unknown default:
            return .undetermined
        }
    }

    private func locationToPosition(_ location: CLLocation) -> GeolocationResponse {
        let altitude = location.verticalAccuracy < 0 ? 0.0 : location.altitude
        let altitudeAccuracy = location.verticalAccuracy < 0 ? 0.0 : location.verticalAccuracy
        let heading = location.course >= 0 ? location.course : -1.0
        let speed = location.speed >= 0 ? location.speed : 0.0

        let coords = GeolocationCoordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            altitude: .second(altitude),
            accuracy: location.horizontalAccuracy,
            altitudeAccuracy: .second(altitudeAccuracy),
            heading: .second(heading),
            speed: .second(speed)
        )

        return GeolocationResponse(
            coords: coords,
            timestamp: location.timestamp.timeIntervalSince1970 * 1000
        )
    }

    private func createLocationError(code: Int, message: String) -> LocationError {
        return LocationError(
            code: Double(code),
            message: message
        )
    }
}

// MARK: - CLLocationManagerDelegate Conformance

extension NitroGeolocation: CLLocationManagerDelegate {}
