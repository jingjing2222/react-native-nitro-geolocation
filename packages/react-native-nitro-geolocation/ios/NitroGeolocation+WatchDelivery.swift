import CoreLocation

extension NitroGeolocation {
    func deliverPositionToWatches(
        location: CLLocation,
        cachedPosition: GeolocationResponse?
    ) {
        var position = cachedPosition
        for (token, subscription) in $watchSubscriptions.entriesSnapshot() {
            let decision = evaluateIOSWatchDelivery(
                previous: subscription.deliveryState,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                distanceFilterMeters: subscription.options.distanceFilter
            )
            guard decision.shouldDeliver else { continue }

            var updatedSubscription = subscription
            updatedSubscription.deliveryState = decision.nextState
            if $watchSubscriptions.updateIfPresent(token: token, value: updatedSubscription) {
                let deliveredPosition = position ?? location.toGeolocationResponse()
                position = deliveredPosition
                subscription.success(deliveredPosition)
            }
        }
    }
}
