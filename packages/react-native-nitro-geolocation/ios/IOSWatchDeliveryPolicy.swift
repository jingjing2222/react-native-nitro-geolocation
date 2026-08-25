import Foundation

struct IOSWatchDeliveryState: Equatable {
    let latitude: Double
    let longitude: Double
}

struct IOSWatchDeliveryDecision {
    let shouldDeliver: Bool
    let nextState: IOSWatchDeliveryState?
}

func evaluateIOSWatchDelivery(
    previous: IOSWatchDeliveryState?,
    latitude: Double,
    longitude: Double,
    distanceFilterMeters: Double
) -> IOSWatchDeliveryDecision {
    let candidate = IOSWatchDeliveryState(latitude: latitude, longitude: longitude)
    guard let previous else {
        return IOSWatchDeliveryDecision(shouldDeliver: true, nextState: candidate)
    }

    let distanceSatisfied = distanceFilterMeters <= 0 || distanceMeters(
        fromLatitude: previous.latitude,
        fromLongitude: previous.longitude,
        toLatitude: latitude,
        toLongitude: longitude
    ) >= distanceFilterMeters
    return distanceSatisfied
        ? IOSWatchDeliveryDecision(shouldDeliver: true, nextState: candidate)
        : IOSWatchDeliveryDecision(shouldDeliver: false, nextState: previous)
}

private func distanceMeters(
    fromLatitude: Double,
    fromLongitude: Double,
    toLatitude: Double,
    toLongitude: Double
) -> Double {
    let latitudeDelta = (toLatitude - fromLatitude) * .pi / 180
    let longitudeDelta = (toLongitude - fromLongitude) * .pi / 180
    let fromLatitudeRadians = fromLatitude * .pi / 180
    let toLatitudeRadians = toLatitude * .pi / 180
    let haversine = pow(sin(latitudeDelta / 2), 2) +
        cos(fromLatitudeRadians) * cos(toLatitudeRadians) *
        pow(sin(longitudeDelta / 2), 2)
    return 2 * 6_371_000 * asin(sqrt(min(max(haversine, 0), 1)))
}
