import Foundation
import CoreLocation
import NitroModules

/**
 * LocationManager Delegate class to handle CLLocationManager callbacks.
 */
private class LocationManagerDelegate: NSObject, CLLocationManagerDelegate {
    weak var geolocation: NitroGeolocation?

    init(geolocation: NitroGeolocation) {
        self.geolocation = geolocation
        super.init()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        geolocation?.handleAuthorizationChange(manager)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        geolocation?.handleLocationUpdate(locations)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        geolocation?.handleLocationError(error)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        geolocation?.handleHeadingUpdate(newHeading)
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        return false
    }
}

/**
 * Geolocation implementation for the native Modern API contract.
 *
 * Key features:
 * - Callback-based native permission and getCurrentPosition for structured errors
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
        let activityType: CLActivityType?
        let pausesLocationUpdatesAutomatically: Bool?
        let showsBackgroundLocationIndicator: Bool?

        static let DEFAULT_TIMEOUT: Double = 10 * 60 * 1000  // 10 minutes in ms
        static let DEFAULT_MAXIMUM_AGE: Double = 0

        static func parse(
            from options: LocationRequestOptions?,
            defaultMaximumAge: Double = DEFAULT_MAXIMUM_AGE
        ) -> ParsedOptions {
            let timeout = options?.timeout ?? DEFAULT_TIMEOUT
            let maximumAge = options?.maximumAge ?? defaultMaximumAge
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

        static func parseLastKnown(from options: LocationRequestOptions?) -> ParsedOptions {
            return parse(from: options, defaultMaximumAge: Double.infinity)
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

    // Watch subscription storage (first-class functions!)
    private struct WatchSubscription {
        let token: String
        let success: (GeolocationResponse) -> Void
        let error: ((LocationError) -> Void)?
        let options: ParsedOptions
    }

    private struct ParsedHeadingOptions {
        let headingFilter: CLLocationDegrees

        static func parse(from options: HeadingOptions?) -> ParsedHeadingOptions {
            return ParsedHeadingOptions(
                headingFilter: options?.headingFilter ?? 0
            )
        }
    }

    private struct HeadingRequest {
        let id: UUID
        let success: (Heading) -> Void
        let error: (LocationError) -> Void
        var timer: DispatchSourceTimer?
    }

    private struct HeadingSubscription {
        let token: String
        let success: (Heading) -> Void
        let error: ((LocationError) -> Void)?
        let options: ParsedHeadingOptions
        var lastDeliveredHeading: Double?
    }

    // MARK: - Properties

    private var configuration: GeolocationConfiguration?
    private var locationManager: CLLocationManager?
    private var locationManagerDelegate: LocationManagerDelegate?
    private var lastLocation: CLLocation?
    private var usingSignificantChanges: Bool = false

    // Permission callbacks
    private var pendingPermissionResolvers: [(PermissionStatus) -> Void] = []

    // getCurrentPosition promise resolvers with timeout
    private var pendingPositionRequests: [UUID: PositionRequest] = [:]

    private struct PositionRequest {
        let id: UUID
        let success: (GeolocationResponse) -> Void
        let error: (LocationError) -> Void
        let options: ParsedOptions
        var timer: DispatchSourceTimer?
    }

    // Watch subscriptions (token -> callback)
    private var watchSubscriptions: [String: WatchSubscription] = [:]

    // Heading requests/subscriptions
    private var pendingHeadingRequests: [UUID: HeadingRequest] = [:]
    private var headingSubscriptions: [String: HeadingSubscription] = [:]
    private var activeGeocoders: [UUID: CLGeocoder] = [:]

    // Error codes
    private let INTERNAL_ERROR = -1
    private let PERMISSION_DENIED = 1
    private let POSITION_UNAVAILABLE = 2
    private let TIMEOUT = 3
    private let PLAY_SERVICE_NOT_AVAILABLE = 4
    private let SETTINGS_NOT_SATISFIED = 5
    private let DEFAULT_HEADING_TIMEOUT_MS: Double = 10_000

    // MARK: - Configuration

    func setConfiguration(config: GeolocationConfiguration) {
        self.configuration = config
    }

    // MARK: - Permission API

    func checkPermission() throws -> Promise<PermissionStatus> {
        return Promise.async {
            let status = CLLocationManager.authorizationStatus()
            return self.mapCLAuthorizationStatus(status)
        }
    }

    func requestPermission(
        success: @escaping (PermissionStatus) -> Void,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        self.initializeLocationManagerIfNeeded()

        let currentStatus = CLLocationManager.authorizationStatus()

        // Already determined
        if currentStatus != .notDetermined {
            let status = self.mapCLAuthorizationStatus(currentStatus)
            success(status)
            return
        }

        // Queue resolver
        self.pendingPermissionResolvers.append(success)

        // Request permission
        let authLevel = self.determineAuthorizationLevel()
        self.requestSystemPermission(for: authLevel)
    }

    // MARK: - Provider/Settings API

    func hasServicesEnabled() throws -> Promise<Bool> {
        return Promise.async {
            return CLLocationManager.locationServicesEnabled()
        }
    }

    func getProviderStatus() throws -> Promise<LocationProviderStatus> {
        return Promise.async {
            return self.createLocationProviderStatus()
        }
    }

    func getLocationAvailability() throws -> Promise<LocationAvailability> {
        return Promise.async {
            guard CLLocationManager.locationServicesEnabled() else {
                return LocationAvailability(
                    available: false,
                    reason: "locationServicesDisabled"
                )
            }

            let status = CLLocationManager.authorizationStatus()
            switch status {
            case .authorizedAlways, .authorizedWhenInUse:
                return LocationAvailability(available: true, reason: nil)
            case .notDetermined:
                return LocationAvailability(
                    available: false,
                    reason: "permissionUndetermined"
                )
            case .denied:
                return LocationAvailability(
                    available: false,
                    reason: "permissionDenied"
                )
            case .restricted:
                return LocationAvailability(
                    available: false,
                    reason: "permissionRestricted"
                )
            @unknown default:
                return LocationAvailability(
                    available: false,
                    reason: "authorizationUnknown"
                )
            }
        }
    }

    func requestLocationSettings(
        success: @escaping (LocationProviderStatus) -> Void,
        error: ((LocationError) -> Void)?,
        options: LocationSettingsOptions?
    ) throws -> Void {
        success(createLocationProviderStatus())
    }

    func getAccuracyAuthorization() throws -> Promise<AccuracyAuthorization> {
        return Promise.async {
            return self.getCurrentAccuracyAuthorizationOnMain()
        }
    }

    func requestTemporaryFullAccuracy(
        purposeKey: String,
        success: @escaping (AccuracyAuthorization) -> Void,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        let trimmedPurposeKey = purposeKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPurposeKey.isEmpty else {
            error?(createLocationError(
                code: INTERNAL_ERROR,
                message: "purposeKey must not be empty."
            ))
            return
        }

        initializeLocationManagerIfNeeded()

        DispatchQueue.main.async {
            guard #available(iOS 14.0, *), let manager = self.locationManager else {
                success(.unknown)
                return
            }

            if manager.accuracyAuthorization == .fullAccuracy {
                success(.full)
                return
            }

            manager.requestTemporaryFullAccuracyAuthorization(
                withPurposeKey: trimmedPurposeKey
            ) { requestError in
                if let requestError {
                    error?(self.createLocationError(
                        code: self.INTERNAL_ERROR,
                        message: "Unable to request temporary full accuracy: \(requestError.localizedDescription)"
                    ))
                    return
                }

                success(self.getCurrentAccuracyAuthorization())
            }
        }
    }

    // MARK: - Get Current Position

    func getCurrentPosition(
        success: @escaping (GeolocationResponse) -> Void,
        error: ((LocationError) -> Void)?,
        options: LocationRequestOptions?
    ) throws -> Void {
        // Check permission
        let status = CLLocationManager.authorizationStatus()
        if status == .denied || status == .restricted {
            let message = status == .restricted
                ? "This application is not authorized to use location services"
                : "User denied access to location services."
            error?(createLocationError(
                code: self.PERMISSION_DENIED,
                message: message
            ))
            return
        }

        if !CLLocationManager.locationServicesEnabled() {
            error?(createLocationError(
                code: self.SETTINGS_NOT_SATISFIED,
                message: "Location services disabled."
            ))
            return
        }

        self.initializeLocationManagerIfNeeded()

        let parsedOptions = ParsedOptions.parse(from: options)

        // Check cached location
        if let cached = self.getBestCachedLocation(options: parsedOptions) {
            self.lastLocation = cached
            let position = self.locationToPosition(cached)
            success(position)
            return
        }

        // Create position request
        let id = UUID()
        var request = PositionRequest(
            id: id,
            success: success,
            error: { locationError in
                error?(locationError)
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
    }

    func getLastKnownPosition(
        success: @escaping (GeolocationResponse) -> Void,
        error: ((LocationError) -> Void)?,
        options: LocationRequestOptions?
    ) throws -> Void {
        let status = CLLocationManager.authorizationStatus()
        if status == .denied || status == .restricted {
            let message = status == .restricted
                ? "This application is not authorized to use location services"
                : "User denied access to location services."
            error?(createLocationError(
                code: self.PERMISSION_DENIED,
                message: message
            ))
            return
        }

        let parsedOptions = ParsedOptions.parseLastKnown(from: options)
        guard let cached = self.getBestCachedLocation(options: parsedOptions) else {
            error?(createLocationError(
                code: self.POSITION_UNAVAILABLE,
                message: "No cached location available."
            ))
            return
        }

        self.lastLocation = cached
        success(self.locationToPosition(cached))
    }

    // MARK: - Geocoding

    func geocode(
        address: String,
        success: @escaping ([GeocodedLocation]) -> Void,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        let query = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            error?(createLocationError(
                code: INTERNAL_ERROR,
                message: "address must not be empty."
            ))
            return
        }

        DispatchQueue.main.async {
            let id = UUID()
            let geocoder = CLGeocoder()
            self.activeGeocoders[id] = geocoder

            geocoder.geocodeAddressString(query) { [weak self] placemarks, geocodeError in
                guard let self else { return }

                DispatchQueue.main.async {
                    self.activeGeocoders.removeValue(forKey: id)

                    if let geocodeError {
                        if self.isNoGeocoderResult(geocodeError) {
                            success([])
                            return
                        }

                        error?(self.createGeocoderError(
                            geocodeError,
                            messagePrefix: "Unable to geocode address"
                        ))
                        return
                    }

                    let locations = (placemarks ?? []).compactMap {
                        self.placemarkToGeocodedLocation($0)
                    }
                    success(locations)
                }
            }
        }
    }

    func reverseGeocode(
        coords: GeocodingCoordinates,
        success: @escaping ([ReverseGeocodedAddress]) -> Void,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        if let validationError = validateGeocodingCoordinates(coords) {
            error?(validationError)
            return
        }

        DispatchQueue.main.async {
            let id = UUID()
            let geocoder = CLGeocoder()
            self.activeGeocoders[id] = geocoder

            let location = CLLocation(
                latitude: coords.latitude,
                longitude: coords.longitude
            )

            geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, geocodeError in
                guard let self else { return }

                DispatchQueue.main.async {
                    self.activeGeocoders.removeValue(forKey: id)

                    if let geocodeError {
                        if self.isNoGeocoderResult(geocodeError) {
                            success([])
                            return
                        }

                        error?(self.createGeocoderError(
                            geocodeError,
                            messagePrefix: "Unable to reverse geocode coordinates"
                        ))
                        return
                    }

                    let addresses = (placemarks ?? []).map {
                        self.placemarkToReverseGeocodedAddress($0)
                    }
                    success(addresses)
                }
            }
        }
    }

    // MARK: - Heading

    func getHeading(
        success: @escaping (Heading) -> Void,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        guard validateHeadingAvailability(error: error) else { return }

        initializeLocationManagerIfNeeded()

        let id = UUID()
        var request = HeadingRequest(
            id: id,
            success: success,
            error: { headingError in
                error?(headingError)
            },
            timer: nil
        )

        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + DEFAULT_HEADING_TIMEOUT_MS / 1000.0)
        timer.setEventHandler { [weak self] in
            self?.handleHeadingTimeout(requestId: id)
        }
        timer.resume()
        request.timer = timer

        pendingHeadingRequests[id] = request
        updateHeadingConfiguration()
        startHeadingMonitoring()
    }

    func watchHeading(
        success: @escaping (Heading) -> Void,
        error: ((LocationError) -> Void)?,
        options: HeadingOptions?
    ) throws -> String {
        let token = UUID().uuidString
        let parsedOptions = ParsedHeadingOptions.parse(from: options)

        if !parsedOptions.headingFilter.isFinite || parsedOptions.headingFilter < 0 {
            error?(createLocationError(
                code: INTERNAL_ERROR,
                message: "headingFilter must be a finite number greater than or equal to 0."
            ))
            return token
        }

        guard validateHeadingAvailability(error: error) else {
            return token
        }

        let subscription = HeadingSubscription(
            token: token,
            success: success,
            error: error,
            options: parsedOptions,
            lastDeliveredHeading: nil
        )

        headingSubscriptions[token] = subscription

        initializeLocationManagerIfNeeded()
        updateHeadingConfiguration()
        startHeadingMonitoring()

        return token
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
        headingSubscriptions.removeValue(forKey: token)

        // Stop monitoring if no more subscriptions or pending requests
        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }

        if headingSubscriptions.isEmpty && pendingHeadingRequests.isEmpty {
            stopHeadingMonitoring()
        } else {
            updateHeadingConfiguration()
        }
    }

    func stopObserving() {
        watchSubscriptions.removeAll()
        headingSubscriptions.removeAll()

        // Stop monitoring if no pending requests
        if pendingPositionRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }

        if pendingHeadingRequests.isEmpty {
            stopHeadingMonitoring()
        } else {
            updateHeadingConfiguration()
        }
    }

    // MARK: - Location Manager Callbacks

    fileprivate func handleAuthorizationChange(_ manager: CLLocationManager) {
        let status = getCurrentAuthorizationStatus(from: manager)
        let mappedStatus = mapCLAuthorizationStatus(status)

        // Resolve pending permission requests
        for resolver in pendingPermissionResolvers {
            resolver(mappedStatus)
        }
        pendingPermissionResolvers.removeAll()

        // If authorized, start monitoring
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            if !pendingPositionRequests.isEmpty || !watchSubscriptions.isEmpty {
                startMonitoring()
            }
        }
    }

    fileprivate func handleLocationUpdate(_ locations: [CLLocation]) {
        guard let location = locations.last else { return }

        lastLocation = location
        let position = locationToPosition(location)

        // 1. Resolve all pending getCurrentPosition requests
        for (id, request) in pendingPositionRequests {
            request.timer?.cancel()
            request.success(position)
        }
        pendingPositionRequests.removeAll()

        // 2. Notify all watch subscriptions (success)
        for (_, subscription) in watchSubscriptions {
            subscription.success(position)
        }

        // 3. Stop monitoring if no more subscriptions or pending requests
        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }
    }

    fileprivate func handleLocationError(_ error: Error) {
        let locationError: LocationError

        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                locationError = createLocationError(
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
            }
        } else {
            locationError = createLocationError(
                code: POSITION_UNAVAILABLE,
                message: "Unable to retrieve location: \(error.localizedDescription)"
            )
        }

        // 1. Reject all pending getCurrentPosition requests
        for (_, request) in pendingPositionRequests {
            request.timer?.cancel()
            request.error(locationError)
        }
        pendingPositionRequests.removeAll()

        // 2. Notify all watch subscriptions (error)
        for (_, subscription) in watchSubscriptions {
            subscription.error?(locationError)
        }

        notifyHeadingConsumersOfLocationError(locationError)
        stopMonitoring()
    }

    fileprivate func handleHeadingUpdate(_ clHeading: CLHeading) {
        let heading = headingToResponse(clHeading)

        for (id, request) in Array(pendingHeadingRequests) {
            request.timer?.cancel()
            request.success(heading)
            pendingHeadingRequests.removeValue(forKey: id)
        }

        for (token, subscription) in Array(headingSubscriptions) {
            let shouldDeliver: Bool
            if let lastDeliveredHeading = subscription.lastDeliveredHeading {
                shouldDeliver = angularDistance(
                    lastDeliveredHeading,
                    heading.magneticHeading
                ) >= subscription.options.headingFilter
            } else {
                shouldDeliver = true
            }

            if shouldDeliver {
                var nextSubscription = subscription
                nextSubscription.lastDeliveredHeading = heading.magneticHeading
                headingSubscriptions[token] = nextSubscription
                nextSubscription.success(heading)
            }
        }

        if pendingHeadingRequests.isEmpty && headingSubscriptions.isEmpty {
            stopHeadingMonitoring()
        } else {
            updateHeadingConfiguration()
        }
    }

    // MARK: - Helper Functions

    private func initializeLocationManagerIfNeeded() {
        guard locationManager == nil else { return }

        if Thread.isMainThread {
            locationManager = CLLocationManager()
            locationManagerDelegate = LocationManagerDelegate(geolocation: self)
            locationManager?.delegate = locationManagerDelegate
        } else {
            DispatchQueue.main.sync {
                locationManager = CLLocationManager()
                locationManagerDelegate = LocationManagerDelegate(geolocation: self)
                locationManager?.delegate = locationManagerDelegate
            }
        }
    }

    private func validateHeadingAvailability(
        error: ((LocationError) -> Void)?
    ) -> Bool {
        let status = CLLocationManager.authorizationStatus()
        if status == .denied || status == .restricted {
            let message = status == .restricted
                ? "This application is not authorized to use location services"
                : "User denied access to location services."
            error?(createLocationError(
                code: PERMISSION_DENIED,
                message: message
            ))
            return false
        }

        if !CLLocationManager.locationServicesEnabled() {
            error?(createLocationError(
                code: SETTINGS_NOT_SATISFIED,
                message: "Location services disabled."
            ))
            return false
        }

        if !CLLocationManager.headingAvailable() {
            error?(createLocationError(
                code: POSITION_UNAVAILABLE,
                message: "Heading is not available on this device."
            ))
            return false
        }

        return true
    }

    private func updateHeadingConfiguration() {
        guard let manager = locationManager else { return }

        var smallestHeadingFilter: CLLocationDegrees?
        for (_, subscription) in headingSubscriptions {
            smallestHeadingFilter = mergeHeadingFilter(
                smallestHeadingFilter,
                subscription.options.headingFilter
            )
        }

        manager.headingFilter = smallestHeadingFilter ?? kCLHeadingFilterNone
    }

    private func startHeadingMonitoring() {
        locationManager?.startUpdatingHeading()
    }

    private func stopHeadingMonitoring() {
        locationManager?.stopUpdatingHeading()
    }

    private func mergeHeadingFilter(
        _ current: CLLocationDegrees?,
        _ next: CLLocationDegrees
    ) -> CLLocationDegrees {
        guard let current else {
            return next
        }

        if current == kCLHeadingFilterNone || next == kCLHeadingFilterNone {
            return kCLHeadingFilterNone
        }

        return min(current, next)
    }

    private func handleHeadingTimeout(requestId: UUID) {
        guard let request = pendingHeadingRequests.removeValue(forKey: requestId) else {
            return
        }

        request.timer?.cancel()
        let timeoutSeconds = DEFAULT_HEADING_TIMEOUT_MS / 1000.0
        let message = String(format: "Unable to fetch heading within %.1fs.", timeoutSeconds)
        request.error(createLocationError(code: TIMEOUT, message: message))

        if pendingHeadingRequests.isEmpty && headingSubscriptions.isEmpty {
            stopHeadingMonitoring()
        } else {
            updateHeadingConfiguration()
        }
    }

    private func notifyHeadingConsumersOfLocationError(_ locationError: LocationError) {
        guard !pendingHeadingRequests.isEmpty || !headingSubscriptions.isEmpty else {
            return
        }

        for (_, request) in pendingHeadingRequests {
            request.timer?.cancel()
            request.error(locationError)
        }
        pendingHeadingRequests.removeAll()

        for (_, subscription) in headingSubscriptions {
            subscription.error?(locationError)
        }
        headingSubscriptions.removeAll()

        stopHeadingMonitoring()
    }

    private func headingToResponse(_ clHeading: CLHeading) -> Heading {
        let trueHeading = clHeading.trueHeading >= 0
            ? clHeading.trueHeading
            : nil
        let accuracy = clHeading.headingAccuracy >= 0
            ? clHeading.headingAccuracy
            : nil

        return Heading(
            magneticHeading: normalizeHeading(clHeading.magneticHeading),
            trueHeading: trueHeading.map(normalizeHeading),
            accuracy: accuracy,
            timestamp: clHeading.timestamp.timeIntervalSince1970 * 1000
        )
    }

    private func angularDistance(_ first: Double, _ second: Double) -> Double {
        let distance = abs(first - second).truncatingRemainder(dividingBy: 360)
        return distance > 180 ? 360 - distance : distance
    }

    private func normalizeHeading(_ value: Double) -> Double {
        let normalized = value.truncatingRemainder(dividingBy: 360)
        return normalized < 0 ? normalized + 360 : normalized
    }

    private func updateLocationManagerConfiguration() {
        guard let manager = locationManager else { return }

        // Merge configurations from all pending requests and watches
        var bestAccuracy: CLLocationAccuracy?
        var smallestDistanceFilter: CLLocationDistance?
        var activityType: CLActivityType?
        var pausesLocationUpdatesAutomatically: Bool?
        var showsBackgroundLocationIndicator = false
        var shouldUseSignificantChanges = false

        for (_, request) in pendingPositionRequests {
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
            shouldUseSignificantChanges = shouldUseSignificantChanges || request.options.useSignificantChanges
        }

        for (_, subscription) in watchSubscriptions {
            bestAccuracy = mergeAccuracy(bestAccuracy, subscription.options.accuracy)
            smallestDistanceFilter = mergeDistanceFilter(
                smallestDistanceFilter,
                subscription.options.distanceFilter
            )
            activityType = mergeActivityType(activityType, subscription.options.activityType)
            pausesLocationUpdatesAutomatically = mergePausesLocationUpdatesAutomatically(
                pausesLocationUpdatesAutomatically,
                subscription.options.pausesLocationUpdatesAutomatically
            )
            showsBackgroundLocationIndicator = showsBackgroundLocationIndicator ||
                (subscription.options.showsBackgroundLocationIndicator ?? false)
            shouldUseSignificantChanges = shouldUseSignificantChanges || subscription.options.useSignificantChanges
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

    private func isCachedLocationValid(_ location: CLLocation, options: ParsedOptions) -> Bool {
        // maximumAge is infinity
        if options.maximumAge.isInfinite {
            return true
        }

        // Check age
        let age = Date().timeIntervalSince(location.timestamp) * 1000  // ms
        return age < options.maximumAge
    }

    private func getBestCachedLocation(options: ParsedOptions) -> CLLocation? {
        initializeLocationManagerIfNeeded()

        return [lastLocation, locationManager?.location]
            .compactMap { $0 }
            .filter { isCachedLocationValid($0, options: options) }
            .max { $0.timestamp < $1.timestamp }
    }

    private func handlePositionTimeout(requestId: UUID) {
        guard let request = pendingPositionRequests.removeValue(forKey: requestId) else {
            return
        }

        request.timer?.cancel()

        let timeoutSeconds = request.options.timeout / 1000.0
        let message = String(format: "Unable to fetch location within %.1fs.", timeoutSeconds)
        let error = createLocationError(code: TIMEOUT, message: message)

        request.error(error)

        // Stop monitoring if no more watches or pending requests
        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
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

    private func getCurrentAccuracyAuthorization() -> AccuracyAuthorization {
        guard #available(iOS 14.0, *) else {
            return .unknown
        }

        let manager = locationManager ?? CLLocationManager()
        switch manager.accuracyAuthorization {
        case .fullAccuracy:
            return .full
        case .reducedAccuracy:
            return .reduced
        @unknown default:
            return .unknown
        }
    }

    private func getCurrentAccuracyAuthorizationOnMain() -> AccuracyAuthorization {
        if Thread.isMainThread {
            return getCurrentAccuracyAuthorization()
        }

        return DispatchQueue.main.sync {
            getCurrentAccuracyAuthorization()
        }
    }

    private func locationToPosition(_ location: CLLocation) -> GeolocationResponse {
        let coords = GeolocationCoordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            altitude: location.nitroGeolocationAltitude,
            accuracy: location.horizontalAccuracy,
            altitudeAccuracy: location.nitroGeolocationAltitudeAccuracy,
            heading: location.nitroGeolocationHeading,
            speed: location.nitroGeolocationSpeed
        )

        return GeolocationResponse(
            coords: coords,
            timestamp: location.timestamp.timeIntervalSince1970 * 1000,
            mocked: location.nitroGeolocationMocked,
            provider: location.nitroGeolocationProvider
        )
    }

    private func placemarkToGeocodedLocation(_ placemark: CLPlacemark) -> GeocodedLocation? {
        guard let location = placemark.location else {
            return nil
        }

        let accuracy = location.horizontalAccuracy >= 0
            ? location.horizontalAccuracy
            : nil

        return GeocodedLocation(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: accuracy
        )
    }

    private func placemarkToReverseGeocodedAddress(_ placemark: CLPlacemark) -> ReverseGeocodedAddress {
        return ReverseGeocodedAddress(
            country: placemark.country.nonEmptyTrimmed,
            region: placemark.administrativeArea.nonEmptyTrimmed,
            city: placemark.locality.nonEmptyTrimmed,
            district: placemark.subLocality.nonEmptyTrimmed,
            street: formatStreet(placemark),
            postalCode: placemark.postalCode.nonEmptyTrimmed,
            formattedAddress: formatAddress(placemark)
        )
    }

    private func formatStreet(_ placemark: CLPlacemark) -> String? {
        return [
            placemark.subThoroughfare.nonEmptyTrimmed,
            placemark.thoroughfare.nonEmptyTrimmed
        ]
            .compactMap { $0 }
            .joined(separator: " ")
            .nonEmptyTrimmed
    }

    private func formatAddress(_ placemark: CLPlacemark) -> String? {
        var parts: [String] = []

        appendDistinct(placemark.name.nonEmptyTrimmed, to: &parts)
        appendDistinct(formatStreet(placemark), to: &parts)
        appendDistinct(placemark.subLocality.nonEmptyTrimmed, to: &parts)
        appendDistinct(placemark.locality.nonEmptyTrimmed, to: &parts)
        appendDistinct(placemark.administrativeArea.nonEmptyTrimmed, to: &parts)
        appendDistinct(placemark.postalCode.nonEmptyTrimmed, to: &parts)
        appendDistinct(placemark.country.nonEmptyTrimmed, to: &parts)

        return parts.joined(separator: ", ").nonEmptyTrimmed
    }

    private func appendDistinct(_ value: String?, to parts: inout [String]) {
        guard let value, !parts.contains(value) else {
            return
        }

        parts.append(value)
    }

    private func validateGeocodingCoordinates(_ coords: GeocodingCoordinates) -> LocationError? {
        if !coords.latitude.isFinite || coords.latitude < -90 || coords.latitude > 90 {
            return createLocationError(
                code: INTERNAL_ERROR,
                message: "latitude must be a finite number between -90 and 90."
            )
        }

        if !coords.longitude.isFinite || coords.longitude < -180 || coords.longitude > 180 {
            return createLocationError(
                code: INTERNAL_ERROR,
                message: "longitude must be a finite number between -180 and 180."
            )
        }

        return nil
    }

    private func isNoGeocoderResult(_ error: Error) -> Bool {
        guard let clError = error as? CLError else {
            return false
        }

        return clError.code == .geocodeFoundNoResult
    }

    private func createGeocoderError(_ error: Error, messagePrefix: String) -> LocationError {
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                return createLocationError(
                    code: PERMISSION_DENIED,
                    message: "\(messagePrefix): geocoder access denied."
                )
            case .network:
                return createLocationError(
                    code: POSITION_UNAVAILABLE,
                    message: "\(messagePrefix): network unavailable."
                )
            default:
                return createLocationError(
                    code: POSITION_UNAVAILABLE,
                    message: "\(messagePrefix): \(error.localizedDescription)"
                )
            }
        }

        return createLocationError(
            code: POSITION_UNAVAILABLE,
            message: "\(messagePrefix): \(error.localizedDescription)"
        )
    }

    private func createLocationError(code: Int, message: String) -> LocationError {
        return LocationError(
            code: Double(code),
            message: message
        )
    }

    private func createLocationProviderStatus() -> LocationProviderStatus {
        return LocationProviderStatus(
            locationServicesEnabled: CLLocationManager.locationServicesEnabled(),
            backgroundModeEnabled: isLocationBackgroundModeEnabled(),
            gpsAvailable: nil,
            networkAvailable: nil,
            passiveAvailable: nil,
            googleLocationAccuracyEnabled: nil
        )
    }

    private func isLocationBackgroundModeEnabled() -> Bool {
        guard let backgroundModes = Bundle.main.object(
            forInfoDictionaryKey: "UIBackgroundModes"
        ) as? [String] else {
            return false
        }

        return backgroundModes.contains("location")
    }
}

private extension Optional where Wrapped == String {
    var nonEmptyTrimmed: String? {
        guard let trimmed = self?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            return nil
        }

        return trimmed.isEmpty ? nil : trimmed
    }
}

private extension String {
    var nonEmptyTrimmed: String? {
        return trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    }

    var nilIfEmpty: String? {
        return isEmpty ? nil : self
    }
}
