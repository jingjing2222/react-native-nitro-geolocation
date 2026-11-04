import Foundation
#if os(iOS)
import UIKit
import CoreLocation
#else
// Only the host contract uses doubles. The simulator harness uses CoreLocation.
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
#endif

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
#if os(iOS)
extension LocationManagerDelegate: CLLocationManagerDelegate {}
#endif
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
#if !os(iOS)
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
#endif
    print("\(results.filter { $0.hasPrefix("PASS") }.count)/\(results.count) passed")
    return results
}

#if os(iOS)
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        let controller = UIViewController()
        controller.view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.1, alpha: 1)
        let text = UITextView(frame: .zero)
        text.translatesAutoresizingMaskIntoConstraints = false
        text.backgroundColor = .clear
        text.textColor = .white
        text.font = .monospacedSystemFont(ofSize: 15, weight: .medium)
        text.isEditable = false
        controller.view.addSubview(text)
        NSLayoutConstraint.activate([
            text.topAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.topAnchor, constant: 20),
            text.bottomAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.bottomAnchor),
            text.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor, constant: 18),
            text.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor, constant: -18)
        ])
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        let results = runContract()
        let failed = results.filter { $0.hasPrefix("FAIL") }.count
        let phase = Bundle.main.object(forInfoDictionaryKey: "EvidencePhase") as? String ?? "TEST"
        text.text = "ISSUE #224 — \(phase)\n\niOS native configuration regression\nReal CLLocationManager\nAlways permission pre-granted\nUIBackgroundModes: location\n\n" + results.joined(separator: "\n\n") + "\n\n\(results.count - failed)/\(results.count) passed\n\nTests production method bodies.\nNot a background delivery E2E."
        text.textColor = failed == 0 ? .systemGreen : .systemRed
        return true
    }
}
#else
@main
struct Contract {
    static func main() {
        exit(runContract().contains { $0.hasPrefix("FAIL") } ? 1 : 0)
    }
}
#endif
