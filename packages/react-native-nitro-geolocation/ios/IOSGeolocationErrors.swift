import CoreLocation
import Foundation

let INTERNAL_ERROR = LocationErrorCode.internalerror
let PERMISSION_DENIED = LocationErrorCode.permissiondenied
let POSITION_UNAVAILABLE = LocationErrorCode.positionunavailable
let TIMEOUT = LocationErrorCode.timeout
let PLAY_SERVICE_NOT_AVAILABLE = LocationErrorCode.playservicesunavailable
let SETTINGS_NOT_SATISFIED = LocationErrorCode.settingsnotsatisfied
let DEFAULT_HEADING_TIMEOUT_MS: Double = 10_000

func createLocationError(code: LocationErrorCode, message: String) -> LocationError {
    return LocationError(
        code: code,
        message: message
    )
}

func createLocationProviderStatus() -> LocationProviderStatus {
    return createLocationProviderStatus(
        locationServicesEnabled: CLLocationManager.locationServicesEnabled()
    )
}

func createLocationProviderStatus(
    locationServicesEnabled: Bool
) -> LocationProviderStatus {
    return LocationProviderStatus(
        authorizationStatus: mapLocationAuthorizationStatus(CLLocationManager.authorizationStatus()),
        locationServicesEnabled: locationServicesEnabled,
        backgroundModeEnabled: isLocationBackgroundModeEnabled(),
        gpsAvailable: nil,
        networkAvailable: nil,
        passiveAvailable: nil,
        googlePlayServicesAvailable: nil,
        googleLocationAccuracyEnabled: nil
    )
}

func mapLocationAuthorizationStatus(_ status: CLAuthorizationStatus) -> LocationAuthorizationStatus {
    switch status {
    case .authorizedAlways: return .always
    case .authorizedWhenInUse: return .wheninuse
    case .denied: return .denied
    case .restricted: return .restricted
    case .notDetermined: return .undetermined
    @unknown default: return .undetermined
    }
}

func createLocationSettingsResult() -> LocationSettingsResult {
    let providerStatus = createLocationProviderStatus()
    return LocationSettingsResult(
        outcome: providerStatus.locationServicesEnabled ? .satisfied : .unavailable,
        providerStatus: providerStatus
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
