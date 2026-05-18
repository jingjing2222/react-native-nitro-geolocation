import CoreLocation
import Foundation

final class LocationManagerDelegate: NSObject, CLLocationManagerDelegate {
    weak var geolocation: NitroGeolocation?

    init(geolocation: NitroGeolocation) {
        self.geolocation = geolocation
        super.init()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        geolocation?.handleAuthorizationChange(manager)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        geolocation?.handleLocationUpdate(locations)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        geolocation?.handleLocationError(error)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        geolocation?.handleHeadingUpdate(newHeading)
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        return false
    }
}
