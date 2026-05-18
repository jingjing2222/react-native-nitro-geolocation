import CoreLocation
import Foundation

final class NitroBackgroundLocationDelegate: NSObject, CLLocationManagerDelegate {
    weak var owner: NitroBackgroundLocation?

    init(owner: NitroBackgroundLocation) {
        self.owner = owner
        super.init()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        owner?.handleLocations(locations)
        owner?.applyDeferredUpdatesIfNeeded(manager)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        owner?.handleError(error)
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        owner?.handleRegion(region, transition: .enter)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        owner?.handleRegion(region, transition: .exit)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        owner?.handleAuthorizationChange()
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        owner?.handleAuthorizationChange()
    }
}
