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
    struct UnifiedLifecycleEvent: Equatable {
        let state: LocationLifecycleState
        let runGeneration: UInt64
        let locationSessionGeneration: UInt64
    }

    private(set) var lifecycleEvents: [UnifiedLifecycleEvent] = []

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

    func handleLocationLifecycleChange(
        _ state: LocationLifecycleState,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        lifecycleEvents.append(
            UnifiedLifecycleEvent(
                state: state,
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
        )
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
            owner.lifecycleEvents == [
                .init(state: .paused, runGeneration: 1, locationSessionGeneration: 1),
                .init(state: .resumed, runGeneration: 1, locationSessionGeneration: 1)
            ],
            "Expected pause and resume callbacks to retain their active-session generations"
        )
        print("iOS location lifecycle delegate contract passed")
    }
}
