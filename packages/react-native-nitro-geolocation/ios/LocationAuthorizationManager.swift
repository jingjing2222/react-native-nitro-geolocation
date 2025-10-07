import CoreLocation

class LocationAuthorizationManager: NSObject, CLLocationManagerDelegate {
    // MARK: - Types

    enum AuthorizationType {
        case always
        case whenInUse
        case none
    }

    // MARK: - Properties

    private var locationManager: CLLocationManager?
    private var queuedCallbacks: [(success: (() -> Void)?, error: ((GeolocationError) -> Void)?)] = []

    // Error codes
    private let PERMISSION_DENIED = 1
    private let POSITION_UNAVAILABLE = 2
    private let TIMEOUT = 3

    // MARK: - Public API

    func requestAuthorization(
        authType: AuthorizationType,
        success: (() -> Void)?,
        error: ((GeolocationError) -> Void)?
    ) {
        initializeLocationManagerIfNeeded()
        enqueueCallbacks(success: success, error: error)

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

    // MARK: - Authorization Helpers

    private func initializeLocationManagerIfNeeded() {
        guard locationManager == nil else { return }
        locationManager = CLLocationManager()
        locationManager?.delegate = self
    }

    private func enqueueCallbacks(success: (() -> Void)?, error: ((GeolocationError) -> Void)?) {
        guard success != nil || error != nil else { return }
        queuedCallbacks.append((success: success, error: error))
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

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
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

    // MARK: - Delegate Helpers

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
        for callback in queuedCallbacks {
            if success {
                callback.success?()
            } else if let error = error {
                callback.error?(error)
            }
        }
        queuedCallbacks.removeAll()
    }
}
