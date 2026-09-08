import CoreLocation
import Foundation

@main
struct IOSPermissionRequestQueueContract {
    static func main() {
        let queue = IOSPermissionRequestQueue()
        var received: [CLAuthorizationStatus] = []
        queue.append { received.append($0) }
        queue.append { received.append($0) }
        queue.resolve(.notDetermined)
        precondition(received.isEmpty, "Initial manager callback must not resolve a permission prompt")
        queue.resolve(.authorizedAlways)
        precondition(received == [.authorizedAlways, .authorizedAlways])
        queue.resolve(.authorizedAlways)
        precondition(received.count == 2, "Each request must resolve only once")

        queue.append { status in
            received.append(status)
            queue.append { received.append($0) }
        }
        queue.resolve(.denied)
        precondition(received.last == .denied && received.count == 3)
        queue.resolve(.restricted)
        precondition(received.last == .restricted && received.count == 4,
                     "A reentrant request must survive the current delivery")
        print("iOS permission request queue contract passed")
    }
}
