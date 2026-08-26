import CoreLocation
import Foundation

final class NitroBackgroundLocationDelegate: NSObject, CLLocationManagerDelegate {
    weak var owner: NitroBackgroundLocation?
    private let runGeneration: UInt64
    private let locationSessionGeneration: UInt64

    init(
        owner: NitroBackgroundLocation,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        self.owner = owner
        self.runGeneration = runGeneration
        self.locationSessionGeneration = locationSessionGeneration
        super.init()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        owner?.handleLocations(
            locations,
            runGeneration: runGeneration,
            locationSessionGeneration: locationSessionGeneration
        )
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        owner?.handleError(
            error,
            runGeneration: runGeneration,
            locationSessionGeneration: locationSessionGeneration
        )
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        owner?.handleRegion(region, transition: .enter, runGeneration: runGeneration)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        owner?.handleRegion(region, transition: .exit, runGeneration: runGeneration)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        owner?.handleAuthorizationChange(
            runGeneration: runGeneration,
            status: manager.authorizationStatus
        )
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        owner?.handleAuthorizationChange(
            runGeneration: runGeneration,
            status: status
        )
    }

    func locationManagerDidPauseLocationUpdates(_ manager: CLLocationManager) {
        owner?.handleLocationLifecycleChange(
            .paused,
            runGeneration: runGeneration,
            locationSessionGeneration: locationSessionGeneration
        )
    }

    func locationManagerDidResumeLocationUpdates(_ manager: CLLocationManager) {
        owner?.handleLocationLifecycleChange(
            .resumed,
            runGeneration: runGeneration,
            locationSessionGeneration: locationSessionGeneration
        )
    }
}
