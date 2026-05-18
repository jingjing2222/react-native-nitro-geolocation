import CoreLocation
import Foundation

let INTERNAL_ERROR = -1
let PERMISSION_DENIED = 1
let POSITION_UNAVAILABLE = 2
let TIMEOUT = 3
let PLAY_SERVICE_NOT_AVAILABLE = 4
let SETTINGS_NOT_SATISFIED = 5
let DEFAULT_HEADING_TIMEOUT_MS: Double = 10_000

func createLocationError(code: Int, message: String) -> LocationError {
    return LocationError(
        code: Double(code),
        message: message
    )
}

func createLocationProviderStatus() -> LocationProviderStatus {
    return LocationProviderStatus(
        locationServicesEnabled: CLLocationManager.locationServicesEnabled(),
        backgroundModeEnabled: isLocationBackgroundModeEnabled(),
        gpsAvailable: nil,
        networkAvailable: nil,
        passiveAvailable: nil,
        googleLocationAccuracyEnabled: nil
    )
}

func isLocationBackgroundModeEnabled() -> Bool {
    guard let backgroundModes = Bundle.main.object(
        forInfoDictionaryKey: "UIBackgroundModes"
    ) as? [String] else {
        return false
    }

    return backgroundModes.contains("location")
}
