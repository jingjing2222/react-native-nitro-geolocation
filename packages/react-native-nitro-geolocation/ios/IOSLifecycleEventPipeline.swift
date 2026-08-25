import Foundation

internal struct IOSLifecycleEventDeliveryPlan {
    let event: BackgroundEventEnvelope
    let storedEvent: StoredBackgroundEventEnvelope?
}

internal func shouldAcceptIOSLifecycleEvent(
    runGeneration: UInt64,
    locationSessionGeneration: UInt64,
    currentRunGeneration: UInt64,
    currentLocationSessionGeneration: UInt64,
    locationSessionActive: Bool
) -> Bool {
    return locationSessionActive &&
        runGeneration == currentRunGeneration &&
        locationSessionGeneration == currentLocationSessionGeneration
}

internal func makeIOSLifecycleEventDeliveryPlan(
    state: LocationLifecycleState,
    timestamp: Double,
    id: String,
    createdAt: Double,
    shouldPersist: Bool
) -> IOSLifecycleEventDeliveryPlan {
    let lifecycle = LocationLifecycleEvent(state: state, timestamp: timestamp)
    let event = BackgroundEventEnvelope(
        location: nil,
        geofence: nil,
        activity: nil,
        providerStatus: nil,
        lifecycle: lifecycle,
        result: nil,
        error: nil,
        id: id,
        type: .lifecycle,
        timestamp: timestamp,
        deliveredToJS: false
    )
    let storedEvent = shouldPersist ? StoredBackgroundEventEnvelope(
        event: event,
        createdAt: createdAt,
        id: id,
        type: event.type,
        timestamp: timestamp,
        deliveredToJS: false
    ) : nil
    return IOSLifecycleEventDeliveryPlan(event: event, storedEvent: storedEvent)
}

internal func makeLifecycleEvent(_ dictionary: [String: Any]) -> LocationLifecycleEvent? {
    guard
        let stateValue = dictionary["state"] as? String,
        let state = LocationLifecycleState(fromString: stateValue),
        let timestamp = dictionary["timestamp"] as? Double
    else {
        return nil
    }
    return LocationLifecycleEvent(state: state, timestamp: timestamp)
}

internal func lifecycleDictionary(_ event: LocationLifecycleEvent) -> [String: Any] {
    return [
        "state": event.state.stringValue,
        "timestamp": event.timestamp
    ]
}
