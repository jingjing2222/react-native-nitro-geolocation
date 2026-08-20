import Foundation
import CoreLocation
import NitroModules

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
    // MARK: - Properties

    private var configuration: GeolocationConfiguration?
    private var locationManager: CLLocationManager?
    private var locationManagerDelegate: LocationManagerDelegate?
    private var lastLocation: CLLocation?
    private var usingSignificantChanges: Bool = false
    lazy var providerStatusWatcher = IOSProviderStatusWatcher()
    private var pendingPermissionResolvers: [(PermissionStatus) -> Void] = []

    // getCurrentPosition promise resolvers with timeout
    internal var pendingPositionRequests: [String: PositionRequest] = [:]

    // Watch subscriptions (token -> callback)
    internal var watchSubscriptions: [String: WatchSubscription] = [:]

    // Heading requests/subscriptions
    private var pendingHeadingRequests: [UUID: HeadingRequest] = [:]
    @ActiveWatchRegistry(kind: .heading)
    private var headingSubscriptions: [String: HeadingSubscription] = [:]
    private var activeGeocoders: [UUID: CLGeocoder] = [:]

    // MARK: - Configuration

    func setConfiguration(config: GeolocationConfiguration) {
        runLocationOperationOnMain {
            self.configuration = config
        }
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
        runLocationOperationOnMain {
            self.initializeLocationManagerIfNeeded()

            let currentStatus = CLLocationManager.authorizationStatus()
            if currentStatus != .notDetermined {
                success(self.mapCLAuthorizationStatus(currentStatus))
                return
            }

            self.pendingPermissionResolvers.append(success)
            self.requestSystemPermission(for: self.determineAuthorizationLevel())
        }
    }

    // MARK: - Provider/Settings API

    func hasServicesEnabled() throws -> Promise<Bool> {
        return Promise.async {
            return CLLocationManager.locationServicesEnabled()
        }
    }

    func getProviderStatus() throws -> Promise<LocationProviderStatus> {
        return Promise.async {
            return createLocationProviderStatus()
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
        success: @escaping (LocationSettingsResult) -> Void,
        options: LocationSettingsOptions,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        success(createLocationSettingsResult())
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

        runLocationOperationOnMain {
            self.initializeLocationManagerIfNeeded()
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
                self.runLocationOperationOnMain {
                    if let requestError {
                        error?(createLocationError(
                            code: INTERNAL_ERROR,
                            message: "Unable to request temporary full accuracy: \(requestError.localizedDescription)"
                        ))
                        return
                    }

                    success(self.getCurrentAccuracyAuthorization())
                }
            }
        }
    }

    // MARK: - Get Current Position

    internal func getCurrentPositionInternal(
        requestId: String,
        success: @escaping (GeolocationResponse) -> Void,
        options: LocationRequestOptions,
        locationServicesEnabled: Bool,
        error: ((LocationError) -> Void)?
    ) {
        dispatchPrecondition(condition: .onQueue(.main))

        // Check permission
        let status = CLLocationManager.authorizationStatus()
        if status == .denied || status == .restricted {
            let message = status == .restricted
                ? "This application is not authorized to use location services"
                : "User denied access to location services."
            error?(createLocationError(
                code: PERMISSION_DENIED,
                message: message
            ))
            return
        }

        if !locationServicesEnabled {
            error?(createLocationError(
                code: SETTINGS_NOT_SATISFIED,
                message: "Location services disabled."
            ))
            return
        }

        self.initializeLocationManagerIfNeeded()

        let parsedOptions = ParsedOptions.parse(from: options)

        // Check cached location
        if let cached = self.getBestCachedLocation(options: parsedOptions) {
            self.lastLocation = cached
            let position = cached.toGeolocationResponse()
            success(position)
            return
        }

        // Create position request
        var request = PositionRequest(
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
            self?.handlePositionTimeout(requestId: requestId)
        }
        timer.resume()
        request.timer = timer

        self.pendingPositionRequests[requestId] = request

        // Update configuration and start monitoring
        self.updateLocationManagerConfiguration()
        self.startMonitoring()
    }

    func getLastKnownPosition(
        success: @escaping (GeolocationResponse) -> Void,
        options: LocationRequestOptions,
        error: ((LocationError) -> Void)?
    ) throws -> Void {
        let parsedOptions = ParsedOptions.parseLastKnown(from: options)
        runLocationOperationOnMain {
            let status = CLLocationManager.authorizationStatus()
            if status == .denied || status == .restricted {
                let message = status == .restricted
                    ? "This application is not authorized to use location services"
                    : "User denied access to location services."
                error?(createLocationError(code: PERMISSION_DENIED, message: message))
                return
            }

            guard let cached = self.getBestCachedLocation(options: parsedOptions) else {
                error?(createLocationError(
                    code: POSITION_UNAVAILABLE,
                    message: "No cached location available."
                ))
                return
            }

            self.lastLocation = cached
            success(self.locationToPosition(cached))
        }
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
                        $0.toGeocodedLocation()
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
                        $0.toReverseGeocodedAddress()
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
        let locationServicesEnabled = CLLocationManager.locationServicesEnabled()
        runLocationOperationOnMain {
            guard self.validateHeadingAvailability(
                locationServicesEnabled: locationServicesEnabled,
                error: error
            ) else { return }
            self.initializeLocationManagerIfNeeded()

            let id = UUID()
            var request = HeadingRequest(
                success: success,
                error: { headingError in error?(headingError) },
                timer: nil
            )
            let timer = DispatchSource.makeTimerSource(queue: .main)
            timer.schedule(deadline: .now() + DEFAULT_HEADING_TIMEOUT_MS / 1000.0)
            timer.setEventHandler { [weak self] in
                self?.handleHeadingTimeout(requestId: id)
            }
            timer.resume()
            request.timer = timer

            self.pendingHeadingRequests[id] = request
            self.updateHeadingConfiguration()
            self.startHeadingMonitoring()
        }
    }

    func watchHeading(
        success: @escaping (Heading) -> Void,
        options: HeadingOptions,
        error: ((LocationError) -> Void)?
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

        let locationServicesEnabled = CLLocationManager.locationServicesEnabled()

        let subscription = HeadingSubscription(
            success: success,
            error: error,
            options: parsedOptions,
            lastDeliveredHeading: nil
        )

        runLocationOperationOnMain {
            guard self.validateHeadingAvailability(
                locationServicesEnabled: locationServicesEnabled,
                error: error
            ) else { return }
            self.headingSubscriptions[token] = subscription
            self.initializeLocationManagerIfNeeded()
            self.updateHeadingConfiguration()
            self.startHeadingMonitoring()
        }

        return token
    }

    func unwatch(token: String) {
        watchSubscriptions.removeValue(forKey: token)
        headingSubscriptions.removeValue(forKey: token)
        providerStatusWatcher.unwatch(token: token)

            self.headingSubscriptions.removeValue(forKey: token)
            if self.headingSubscriptions.isEmpty && self.pendingHeadingRequests.isEmpty {
                self.stopHeadingMonitoring()
            } else {
                self.updateHeadingConfiguration()
            }
        }
    }

    func getActiveWatches() -> [ActiveWatch] {
        let watches = $watchSubscriptions.snapshot() + $headingSubscriptions.snapshot()
        return watches.sorted { $0.token < $1.token }
    }

    func stopObserving() {
        watchSubscriptions.removeAll()
        headingSubscriptions.removeAll()
        providerStatusWatcher.stopObserving()

            self.headingSubscriptions.removeAll()
            if self.pendingHeadingRequests.isEmpty {
                self.stopHeadingMonitoring()
            } else {
                self.updateHeadingConfiguration()
            }
        }
    }

    func handleAuthorizationChange(_ manager: CLLocationManager) {
        let status = getCurrentAuthorizationStatus(from: manager)
        let mappedStatus = mapCLAuthorizationStatus(status)

        // Snapshot state before invoking JS callbacks because they can re-enter this instance.
        let resolvers = pendingPermissionResolvers
        pendingPermissionResolvers.removeAll()
        let shouldStartMonitoring = !pendingPositionRequests.isEmpty || !watchSubscriptions.isEmpty
        for resolver in resolvers {
            resolver(mappedStatus)
        }

        // If authorized, start monitoring
        if shouldStartMonitoring && (status == .authorizedAlways || status == .authorizedWhenInUse) {
            startMonitoring()
        }
    }

    func handleLocationUpdate(_ locations: [CLLocation]) {
        guard let location = locations.last else { return }

        lastLocation = location
        let position = location.toGeolocationResponse()

        let positionRequests = Array(pendingPositionRequests.values)
        pendingPositionRequests.removeAll()
        for request in positionRequests {
            request.timer?.cancel()
            request.success(position)
        }

        let subscriptions = Array(watchSubscriptions.values)
        for subscription in subscriptions {
            subscription.success(position)
        }

        if watchSubscriptions.isEmpty && pendingPositionRequests.isEmpty {
            stopMonitoring()
        } else {
            updateLocationManagerConfiguration()
        }
    }

    func handleLocationError(_ error: Error) {
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

        let positionRequests = Array(pendingPositionRequests.values)
        pendingPositionRequests.removeAll()
        for request in positionRequests {
            request.timer?.cancel()
            request.error(locationError)
        }

        let subscriptions = Array(watchSubscriptions.values)
        for subscription in subscriptions {
            subscription.error?(locationError)
        }

        notifyHeadingConsumersOfLocationError(locationError)
        stopMonitoring()
    }

    func handleHeadingUpdate(_ clHeading: CLHeading) {
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
                if $headingSubscriptions.updateIfPresent(token: token, value: nextSubscription) {
                    nextSubscription.success(heading)
                }
            }
        }

        if pendingHeadingRequests.isEmpty && headingSubscriptions.isEmpty {
            stopHeadingMonitoring()
        } else {
            updateHeadingConfiguration()
        }
    }

    // MARK: - Helper Functions

    internal func initializeLocationManagerIfNeeded() {
        if Thread.isMainThread {
            initializeLocationManagerOnMainIfNeeded()
        } else {
            DispatchQueue.main.sync {
                self.initializeLocationManagerOnMainIfNeeded()
            }
        }
    }

    private func initializeLocationManagerOnMainIfNeeded() {
        dispatchPrecondition(condition: .onQueue(.main))
        guard locationManager == nil else { return }

        let manager = CLLocationManager()
        let delegate = LocationManagerDelegate(geolocation: self)
        manager.delegate = delegate
        locationManagerDelegate = delegate
        locationManager = manager
    }

    private func validateHeadingAvailability(
        locationServicesEnabled: Bool,
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

        if !locationServicesEnabled {
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

        let headingRequests = Array(pendingHeadingRequests.values)
        pendingHeadingRequests.removeAll()
        for request in headingRequests {
            request.timer?.cancel()
            request.error(locationError)
        }

        let subscriptions = Array(headingSubscriptions.values)
        headingSubscriptions.removeAll()
        for subscription in subscriptions {
            subscription.error?(locationError)
        }

        if pendingHeadingRequests.isEmpty && headingSubscriptions.isEmpty {
            stopHeadingMonitoring()
        } else {
            updateHeadingConfiguration()
            startHeadingMonitoring()
        }
    }

    internal func updateLocationManagerConfiguration() {
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

    internal func startMonitoring() {
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

    private func getBestCachedLocation(options: ParsedOptions) -> CLLocation? {
        initializeLocationManagerIfNeeded()

        return [lastLocation, locationManager?.location]
            .compactMap { $0 }
            .filter { isCachedLocationValid($0, options: options) }
            .max { $0.timestamp < $1.timestamp }
    }

    private func handlePositionTimeout(requestId: String) {
        guard let request = pendingPositionRequests.removeValue(forKey: requestId) else {
            return
        }

        request.timer?.cancel()

        let timeoutSeconds = request.options.timeout / 1000.0
        let message = String(format: "Unable to fetch location within %.1fs.", timeoutSeconds)
        let error = createLocationError(code: TIMEOUT, message: message)

        request.error(error)

        updateMonitoringAfterPositionRequestRemoval()
    }

    internal func updateMonitoringAfterPositionRequestRemoval() {
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

}
