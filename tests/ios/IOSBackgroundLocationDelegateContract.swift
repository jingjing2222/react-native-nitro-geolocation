import CoreLocation
import Foundation

enum LocationLifecycleState: Equatable {
    case paused
    case resumed
}

enum GeofenceTransition {
    case enter
    case exit
}

final class NitroBackgroundLocation {
    private(set) var lifecycleStates: [LocationLifecycleState] = []

    func handleLocations(_ locations: [CLLocation]) {}

    func applyDeferredUpdatesIfNeeded(_ manager: CLLocationManager) {}

    func handleError(_ error: Error) {}

    func handleRegion(_ region: CLRegion, transition: GeofenceTransition) {}

    func handleAuthorizationChange() {}

    func handleLocationLifecycleChange(_ state: LocationLifecycleState) {
        lifecycleStates.append(state)
    }
}

@main
enum IOSBackgroundLocationDelegateContract {
    static func main() {
        let owner = NitroBackgroundLocation()
        let delegate = NitroBackgroundLocationDelegate(owner: owner)
        let manager = CLLocationManager()

        delegate.locationManagerDidPauseLocationUpdates(manager)
        delegate.locationManagerDidResumeLocationUpdates(manager)

        precondition(
            owner.lifecycleStates == [.paused, .resumed],
            "Expected native pause and resume callbacks to reach the owner in order"
        )
        print("iOS location lifecycle delegate contract passed")
    }
}
