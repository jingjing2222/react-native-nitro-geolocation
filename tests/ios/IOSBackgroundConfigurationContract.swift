import Foundation
// Fast host unit contract. App-level delivery is covered by test-issue-224-ios.mjs.
enum CLAuthorizationStatus { case notDetermined, authorizedAlways, authorizedWhenInUse, denied, restricted }
final class CLLocationManager {
    static var status = CLAuthorizationStatus.authorizedAlways
    static func authorizationStatus() -> CLAuthorizationStatus { status }
    var delegate: LocationManagerDelegate?
    var allowsBackgroundLocationUpdates = false
    func requestAlwaysAuthorization() { permissionPrompts += 1 }
    func requestWhenInUseAuthorization() { permissionPrompts += 1 }
}
enum Bundle {
    static let main = TestBundle()
}
final class TestBundle {
    var modes: [String]? = ["location"]
    func object(forInfoDictionaryKey key: String) -> Any? { modes }
}

var permissionPrompts = 0
enum AuthorizationLevel { case always, wheninuse, auto }
struct GeolocationConfiguration {
    var authorizationLevel: AuthorizationLevel? = .always
    var enableBackgroundLocationUpdates: Bool?
}
typealias PermissionStatus = CLAuthorizationStatus
struct LocationError {}
func mapCLAuthorizationStatus(_ status: CLAuthorizationStatus) -> PermissionStatus { status }
func determineAuthorizationLevelFromInfoPlist() -> AuthorizationLevel { .always }
final class PermissionQueue {
    func append(_ callback: @escaping (CLAuthorizationStatus) -> Void) {}
}
final class LocationManagerDelegate: NSObject {
    init(geolocation: NitroGeolocation) {}
}
final class NitroGeolocation {
    private var configuration: GeolocationConfiguration?
    private var locationManager: CLLocationManager?
    private var locationManagerDelegate: LocationManagerDelegate?
    private let pendingPermissionResolvers = PermissionQueue()

    // PRODUCTION_METHODS

    var backgroundEnabled: Bool { locationManager?.allowsBackgroundLocationUpdates ?? false }
    var managerExists: Bool { locationManager != nil }
}

func runContract() -> [String] {
    var results: [String] = []
    func expect(_ name: String, _ condition: Bool) {
        let result = "\(condition ? "PASS" : "FAIL")  \(name)"
        print(result)
        results.append(result)
    }
    let enabled = GeolocationConfiguration(enableBackgroundLocationUpdates: true)
    let disabled = GeolocationConfiguration(enableBackgroundLocationUpdates: false)
    let geo = NitroGeolocation()
    geo.setConfiguration(config: enabled)
    expect("Configuration keeps manager lazy", !geo.managerExists)
    var permission: PermissionStatus?
    try! geo.requestPermission(success: { permission = $0 }, error: nil)
    expect("Pre-granted permission resolves", permission == .authorizedAlways)
    expect("Pre-granted permission enables background", geo.backgroundEnabled)
    geo.setConfiguration(config: disabled)
    expect("Explicit false disables background", !geo.backgroundEnabled)
    geo.setConfiguration(config: enabled)
    expect("Existing manager applies true", geo.backgroundEnabled)
    geo.setConfiguration(config: GeolocationConfiguration())
    expect("Omitted option restores default false", !geo.backgroundEnabled)

    let direct = NitroGeolocation()
    direct.setConfiguration(config: enabled)
    direct.initializeLocationManagerIfNeeded()
    expect("Initialization without permission request", direct.backgroundEnabled)
    let late = NitroGeolocation()
    late.initializeLocationManagerIfNeeded()
    expect("Default remains foreground only", !late.backgroundEnabled)
    late.setConfiguration(config: enabled)
    expect("Configuration after initialization", late.backgroundEnabled)
    let whenInUse = NitroGeolocation()
    whenInUse.setConfiguration(config: GeolocationConfiguration(
        authorizationLevel: .wheninuse, enableBackgroundLocationUpdates: true))
    whenInUse.initializeLocationManagerIfNeeded()
    expect("Independent of requested authorization level", whenInUse.backgroundEnabled)
    expect("Already granted never prompts", permissionPrompts == 0)
    for modes: [String]? in [nil, [], ["audio"]] {
        Bundle.main.modes = modes
        let missingMode = NitroGeolocation()
        missingMode.setConfiguration(config: enabled)
        missingMode.initializeLocationManagerIfNeeded()
        expect("Missing location mode stays disabled: \(String(describing: modes))", !missingMode.backgroundEnabled)
    }
    Bundle.main.modes = ["location"]
    for status in [CLAuthorizationStatus.authorizedWhenInUse, .denied, .restricted] {
        CLLocationManager.status = status
        let existingPermission = NitroGeolocation()
        existingPermission.setConfiguration(config: enabled)
        var resolved: CLAuthorizationStatus?
        try! existingPermission.requestPermission(success: { resolved = $0 }, error: nil)
        expect("Existing authorization is preserved: \(status)", resolved == status)
    }
    expect("No permission prompts introduced", permissionPrompts == 0)
    CLLocationManager.status = .notDetermined
    let fresh = NitroGeolocation()
    fresh.setConfiguration(config: enabled)
    try! fresh.requestPermission(success: { _ in }, error: nil)
    expect("Fresh installation still requests permission", permissionPrompts == 1)
    expect("Fresh installation applies background configuration", fresh.backgroundEnabled)
    print("\(results.filter { $0.hasPrefix("PASS") }.count)/\(results.count) passed")
    return results
}

@main
struct Contract {
    static func main() {
        exit(runContract().contains { $0.hasPrefix("FAIL") } ? 1 : 0)
    }
}
