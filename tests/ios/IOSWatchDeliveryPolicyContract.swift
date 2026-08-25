import Foundation

@main
enum IOSWatchDeliveryPolicyContract {
    static func main() {
        let first = evaluateIOSWatchDelivery(
            previous: nil,
            latitude: 37.5665,
            longitude: 126.9780,
            distanceFilterMeters: 500
        )
        precondition(first.shouldDeliver, "The first update must establish a baseline")

        let baseline = first.nextState
        let near = evaluateIOSWatchDelivery(
            previous: baseline,
            latitude: 37.5695,
            longitude: 126.9780,
            distanceFilterMeters: 500
        )
        precondition(!near.shouldDeliver, "A near update must stay subscription-local")
        precondition(near.nextState == baseline, "Suppression must not move the baseline")

        let cumulative = evaluateIOSWatchDelivery(
            previous: near.nextState,
            latitude: 37.5725,
            longitude: 126.9780,
            distanceFilterMeters: 500
        )
        precondition(cumulative.shouldDeliver, "Distance is measured from last delivery")

        print("iOS watch delivery policy contract passed")
    }
}
