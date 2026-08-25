import CoreLocation
import Foundation

enum LocationLifecycleState: Equatable {
    case paused
    case resumed

    init?(fromString value: String) {
        switch value {
        case "paused": self = .paused
        case "resumed": self = .resumed
        default: return nil
        }
    }

    var stringValue: String {
        switch self {
        case .paused: return "paused"
        case .resumed: return "resumed"
        }
    }
}

struct LocationLifecycleEvent: Equatable {
    let state: LocationLifecycleState
    let timestamp: Double
}

enum BackgroundEventType: Equatable {
    case lifecycle
}

struct BackgroundEventEnvelope: Equatable {
    let lifecycle: LocationLifecycleEvent?
    let id: String
    let type: BackgroundEventType
    let timestamp: Double

    init(
        location: Any?,
        geofence: Any?,
        activity: Any?,
        providerStatus: Any?,
        lifecycle: LocationLifecycleEvent?,
        result: Any?,
        error: Any?,
        id: String,
        type: BackgroundEventType,
        timestamp: Double,
        deliveredToJS: Bool
    ) {
        self.lifecycle = lifecycle
        self.id = id
        self.type = type
        self.timestamp = timestamp
    }
}

struct StoredBackgroundEventEnvelope: Equatable {
    let event: BackgroundEventEnvelope
    let createdAt: Double
    let id: String
    let type: BackgroundEventType
    let timestamp: Double
    let deliveredToJS: Bool
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

        precondition(
            shouldAcceptIOSLifecycleEvent(
                runGeneration: 3,
                locationSessionGeneration: 5,
                currentRunGeneration: 3,
                currentLocationSessionGeneration: 5,
                locationSessionActive: true
            )
        )
        precondition(
            !shouldAcceptIOSLifecycleEvent(
                runGeneration: 2,
                locationSessionGeneration: 5,
                currentRunGeneration: 3,
                currentLocationSessionGeneration: 5,
                locationSessionActive: true
            )
        )
        precondition(
            !shouldAcceptIOSLifecycleEvent(
                runGeneration: 3,
                locationSessionGeneration: 4,
                currentRunGeneration: 3,
                currentLocationSessionGeneration: 5,
                locationSessionActive: true
            )
        )

        let persisted = makeIOSLifecycleEventDeliveryPlan(
            state: .paused,
            timestamp: 123,
            id: "lifecycle-1",
            createdAt: 124,
            shouldPersist: true
        )
        precondition(persisted.event.lifecycle == .init(state: .paused, timestamp: 123))
        precondition(persisted.storedEvent?.event == persisted.event)
        precondition(persisted.storedEvent?.createdAt == 124)

        let liveOnly = makeIOSLifecycleEventDeliveryPlan(
            state: .resumed,
            timestamp: 456,
            id: "lifecycle-2",
            createdAt: 457,
            shouldPersist: false
        )
        precondition(liveOnly.storedEvent == nil)
        precondition(
            makeLifecycleEvent(lifecycleDictionary(liveOnly.event.lifecycle!)) ==
                liveOnly.event.lifecycle,
            "Expected production lifecycle serialization to round-trip"
        )
        print("iOS location lifecycle delegate contract passed")
    }
}
