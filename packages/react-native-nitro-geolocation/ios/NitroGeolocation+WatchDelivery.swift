import CoreLocation

extension NitroGeolocation {
    func deliverPositionToWatches(
        location: CLLocation,
        position: GeolocationResponse
    ) {
        for (token, subscription) in Array(watchSubscriptions) {
            let decision = evaluateIOSWatchDelivery(
                previous: subscription.deliveryState,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                distanceFilterMeters: subscription.options.distanceFilter
            )
            guard decision.shouldDeliver, watchSubscriptions[token] != nil else { continue }

            var updatedSubscription = subscription
            updatedSubscription.deliveryState = decision.nextState
            watchSubscriptions[token] = updatedSubscription
            subscription.success(position)
        }
    }
}
