import CoreLocation
import Foundation

final class IOSBackgroundPermissionRequest {
    let semaphore = DispatchSemaphore(value: 0)
    private var completed = false

    func authorizationDidChange(to status: CLAuthorizationStatus) {
        guard !completed, status != .notDetermined else { return }
        completed = true
        semaphore.signal()
    }
}

extension NitroBackgroundLocation {
    func requestBackgroundPermissionResult() -> BackgroundPermissionResult {
        return withLifecycleLock {
            let status = CLLocationManager.authorizationStatus()
            let request = status == .notDetermined ? IOSBackgroundPermissionRequest() : nil
            withStoreLock { permissionRequest = request }
            ensureManager()
            runOnMainSync {
                self.manager?.requestAlwaysAuthorization()
            }
            withStoreLock {
                request?.authorizationDidChange(
                    to: CLLocationManager.authorizationStatus()
                )
            }
            if Thread.isMainThread == false {
                _ = request?.semaphore.wait(timeout: .now() + 60)
            }
            withStoreLock {
                if permissionRequest === request {
                    permissionRequest = nil
                }
            }
            return permissionResult()
        }
    }

    func permissionResult() -> BackgroundPermissionResult {
        return withLifecycleLock {
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
                needsSettingsRedirect: background != .granted,
                canAskAgain: foreground == .undetermined
            )
        }
    }
}
