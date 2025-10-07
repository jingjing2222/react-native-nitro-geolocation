import CoreLocation

class NitroGeolocation: NSObject, HybridNitroGeolocationSpec, CLLocationManagerDelegate {
    // MARK: - Types

    private enum AuthorizationType {
        case always
        case whenInUse
        case none
    }

    // MARK: - Properties

    private var configuration: RNConfigurationInternal = RNConfigurationInternal(
        skipPermissionRequests: false,
        authorizationLevel: nil,
        enableBackgroundLocationUpdates: nil,
        locationProvider: nil
    )

    private var locationManager: CLLocationManager?
    private var queuedAuthorizationCallbacks: [(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)] = []

    // Error codes
    private let PERMISSION_DENIED = 1
    private let POSITION_UNAVAILABLE = 2
    private let TIMEOUT = 3

    // MARK: - Public API

    public func setRNConfiguration(config: RNConfigurationInternal) throws {
        configuration = config
    }

    public func requestAuthorization(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)
        throws
    {
        initializeLocationManagerIfNeeded()
        enqueueCallbacks(success: success, error: error)

        let authType = determineAuthorizationType()
        requestPermission(for: authType)
    }

    // MARK: - Authorization Helpers

    private func initializeLocationManagerIfNeeded() {
        guard locationManager == nil else { return }
        locationManager = CLLocationManager()
        locationManager?.delegate = self
    }

    private func enqueueCallbacks(success: (() -> Void)?, error: ((GeolocationError) -> Void)?) {
        guard success != nil || error != nil else { return }
        queuedAuthorizationCallbacks.append((success: success, error: error))
    }

    private func determineAuthorizationType() -> AuthorizationType {
        guard let authLevel = configuration.authorizationLevel else {
            return determineAuthorizationTypeFromInfoPlist()
        }

        switch authLevel {
        case .ALWAYS:
            return .always
        case .WHENINUSE:
            return .whenInUse
        case .AUTO:
            return determineAuthorizationTypeFromInfoPlist()
        }
    }

    private func determineAuthorizationTypeFromInfoPlist() -> AuthorizationType {
        if hasInfoPlistKey(for: .always) {
            return .always
        } else if hasInfoPlistKey(for: .whenInUse) {
            return .whenInUse
        }
        return .none
    }

    private func hasInfoPlistKey(for type: AuthorizationType) -> Bool {
        switch type {
        case .always:
            return Bundle.main.object(forInfoDictionaryKey: "NSLocationAlwaysUsageDescription") != nil ||
                   Bundle.main.object(forInfoDictionaryKey: "NSLocationAlwaysAndWhenInUseUsageDescription") != nil
        case .whenInUse:
            return Bundle.main.object(forInfoDictionaryKey: "NSLocationWhenInUseUsageDescription") != nil
        case .none:
            return false
        }
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
        guard let backgroundModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String],
              backgroundModes.contains("location") else {
            return
        }
        locationManager?.allowsBackgroundLocationUpdates = true
    }

    public func getCurrentPosition(
        success: @escaping (GeolocationPosition) -> Void, error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) throws {
        // TODO: Implement
    }

    public func watchPosition(
        success: @escaping (GeolocationPosition) -> Void, error: ((GeolocationError) -> Void)?,
        options: GeolocationOptions?
    ) throws -> Double {
        // TODO: Implement
        return 0
    }

    public func clearWatch(watchId: Double) throws {
        // TODO: Implement
    }

    public func stopObserving() throws {
        // TODO: Implement
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = getCurrentAuthorizationStatus(from: manager)

        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            handleAuthorizationSuccess()
        case .denied, .restricted:
            handleAuthorizationError(for: status)
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }

    // MARK: - Authorization Delegate Helpers

    private func getCurrentAuthorizationStatus(from manager: CLLocationManager) -> CLAuthorizationStatus {
        if #available(iOS 14.0, *) {
            return manager.authorizationStatus
        } else {
            return CLLocationManager.authorizationStatus()
        }
    }

    private func handleAuthorizationSuccess() {
        invokeQueuedCallbacks(success: true)
    }

    private func handleAuthorizationError(for status: CLAuthorizationStatus) {
        let error = createGeolocationError(for: status)
        invokeQueuedCallbacks(error: error)
    }

    private func createGeolocationError(for status: CLAuthorizationStatus) -> GeolocationError {
        let message = status == .restricted
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

    private func invokeQueuedCallbacks(success: Bool = false, error: GeolocationError? = nil) {
        for callback in queuedAuthorizationCallbacks {
            if success {
                callback.success?()
            } else if let error = error {
                callback.error?(error)
            }
        }
        queuedAuthorizationCallbacks.removeAll()
    }
}
