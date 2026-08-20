import CoreLocation
import Foundation

private protocol NitroBackgroundLocationGenerationAware {
    func handleLocations(
        _ locations: [CLLocation],
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    )
    func applyDeferredUpdatesIfNeeded(
        _ manager: CLLocationManager,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    )
    func handleError(
        _ error: Error,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    )
    func handleRegion(
        _ region: CLRegion,
        transition: GeofenceTransition,
        runGeneration: UInt64
    )
    func handleAuthorizationChange(runGeneration: UInt64, status: CLAuthorizationStatus)
}

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
    convenience init(owner: NitroBackgroundLocation) {
        self.init(owner: owner, runGeneration: 0, locationSessionGeneration: 0)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let owner = owner as? NitroBackgroundLocationGenerationAware {
            owner.handleLocations(
                locations,
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
            owner.applyDeferredUpdatesIfNeeded(
                manager,
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
            return
        }
        owner?.handleLocations(locations)
        owner?.applyDeferredUpdatesIfNeeded(manager)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let owner = owner as? NitroBackgroundLocationGenerationAware {
            owner.handleError(
                error,
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
            return
        }
        owner?.handleError(error)
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        if let owner = owner as? NitroBackgroundLocationGenerationAware {
            owner.handleRegion(region, transition: .enter, runGeneration: runGeneration)
            return
        }
        owner?.handleRegion(region, transition: .enter)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        if let owner = owner as? NitroBackgroundLocationGenerationAware {
            owner.handleRegion(region, transition: .exit, runGeneration: runGeneration)
            return
        }
        owner?.handleRegion(region, transition: .exit)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        owner?.handleAuthorizationChange()
        if let owner = owner as? NitroBackgroundLocationGenerationAware {
            owner.handleAuthorizationChange(
                runGeneration: runGeneration,
                status: manager.authorizationStatus
            )
        }
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        owner?.handleAuthorizationChange()
        if let owner = owner as? NitroBackgroundLocationGenerationAware {
            owner.handleAuthorizationChange(
                runGeneration: runGeneration,
                status: status
            )
        }
    }

    func locationManagerDidPauseLocationUpdates(_ manager: CLLocationManager) {
        owner?.handleLocationLifecycleChange(.paused)
    }

    func locationManagerDidResumeLocationUpdates(_ manager: CLLocationManager) {
        owner?.handleLocationLifecycleChange(.resumed)
    }
}
