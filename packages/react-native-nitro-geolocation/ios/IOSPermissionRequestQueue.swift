import CoreLocation
import Foundation

/// Main-thread-owned permission requests. Core Location's initial delegate
/// notification is not a user decision and must not consume pending requests.
final class IOSPermissionRequestQueue {
    private var callbacks: [(CLAuthorizationStatus) -> Void] = []

    func append(_ callback: @escaping (CLAuthorizationStatus) -> Void) {
        dispatchPrecondition(condition: .onQueue(.main))
        callbacks.append(callback)
    }

    func resolve(_ status: CLAuthorizationStatus) {
        dispatchPrecondition(condition: .onQueue(.main))
        guard status != .notDetermined else { return }
        let pending = callbacks
        callbacks.removeAll()
        pending.forEach { $0(status) }
    }
}
