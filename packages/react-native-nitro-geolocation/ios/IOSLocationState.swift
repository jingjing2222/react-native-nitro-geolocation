import CoreLocation
import Foundation

internal func withLocationStateOnMain<T>(_ operation: () -> T) -> T {
    if Thread.isMainThread { return operation() }
    return DispatchQueue.main.sync(execute: operation)
}

func currentAccuracyAuthorization(from locationManager: CLLocationManager?) -> AccuracyAuthorization {
    dispatchPrecondition(condition: .onQueue(.main))
    guard #available(iOS 14.0, *) else { return .unknown }
    let manager = locationManager ?? CLLocationManager()
    switch manager.accuracyAuthorization {
    case .fullAccuracy:
        return .full
    case .reducedAccuracy:
        return .reduced
    @unknown default:
        return .unknown
    }
}

func currentAccuracyAuthorizationOnMain(
    from locationManager: @autoclosure () -> CLLocationManager?
) -> AccuracyAuthorization {
    // Defer the property read too: evaluating it before dispatch races manager initialization.
    return withLocationStateOnMain {
        currentAccuracyAuthorization(from: locationManager())
    }
}
