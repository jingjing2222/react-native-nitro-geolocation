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

    func handleLocations(
        _ locations: [CLLocation],
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {}

    func applyDeferredUpdatesIfNeeded(
        _ manager: CLLocationManager,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {}

    func handleError(
        _ error: Error,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {}

    func handleRegion(
        _ region: CLRegion,
        transition: GeofenceTransition,
        runGeneration: UInt64
    ) {}

    func handleAuthorizationChange(
        runGeneration: UInt64,
        status: CLAuthorizationStatus
    ) {}

    func handleLocationLifecycleChange(_ state: LocationLifecycleState) {
        lifecycleStates.append(state)
    }
}

@main
enum IOSBackgroundLocationDelegateContract {
    static func main() {
        let owner = NitroBackgroundLocation()
        let delegate = NitroBackgroundLocationDelegate(
            owner: owner,
            runGeneration: 1,
            locationSessionGeneration: 1
        )
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
