import CoreLocation

extension NitroBackgroundLocation {
    func permissionResult() -> BackgroundPermissionResult {
        ensureManager()
        let status = CLLocationManager.authorizationStatus()
        let foreground: PermissionStatus
        let background: BackgroundPermissionStatus
        switch status {
        case .authorizedAlways:
            foreground = .granted
            background = .granted
        case .authorizedWhenInUse:
            foreground = .granted
            background = .denied
        case .denied:
            foreground = .denied
            background = .denied
        case .restricted:
            foreground = .restricted
            background = .restricted
        case .notDetermined:
            foreground = .undetermined
            background = .undetermined
        @unknown default:
            foreground = .undetermined
            background = .undetermined
        }

        let accuracy: AccuracyAuthorization
        if #available(iOS 14.0, *) {
            accuracy = manager?.accuracyAuthorization == .fullAccuracy ? .full : .reduced
        } else {
            accuracy = .unknown
        }

        return BackgroundPermissionResult(
            foreground: foreground,
            background: background,
            accuracyAuthorization: accuracy,
            canRequestBackgroundInline: true,
            needsSettingsRedirect: background != .granted
        )
    }
}
