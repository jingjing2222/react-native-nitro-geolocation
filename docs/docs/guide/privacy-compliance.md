# Privacy and Compliance

This page describes the library's behavior and gives integrators an audit
starting point. It is not legal advice. Your app determines its purposes,
retention, recipients, disclosures, and lawful basis for location processing.

## Project statement

`react-native-nitro-geolocation` has no maintainer-operated telemetry or
analytics endpoint. It does not create an advertising identifier, sell location
data, or automatically transmit runtime data to the maintainers. Installing the
package does not request location permission and does not start location
collection.

The source-of-truth short statement is also available in the repository's
[`PRIVACY.md`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/PRIVACY.md).

## Data-flow inventory

| Feature | Activation | Data and destination | Retention |
| --- | --- | --- | --- |
| Current position, foreground watch, heading, provider and lifecycle APIs | An app calls the API after handling permission | Platform results are returned to the app process. The library does not send them to a project server. | No library-managed durable storage for foreground-only calls. |
| Background records and events | An app configures and starts background location | Location records and enabled background events are processed by the native app. | Android stores records in an app-private SQLite database; iOS uses app-private `UserDefaults`. Records are retained by default unless `persist: false`; configure `maxStoredLocations` and `maxStoredEvents`, then use `clearStoredBackgroundLocations()` and `clearStoredBackgroundEvents()`. |
| Background configuration | An app calls `configureBackgroundLocation()` or starts with options | The complete configuration, including a sync URL, headers, and `bodyTemplate`, is stored in Android app-private `SharedPreferences` or iOS app-private `UserDefaults`. These stores are not credential vaults. | This happens independently of `persist: false`, record clearing, and sync `autoClear`. `resetBackgroundLocation()` removes the configuration and all library-managed background state. |
| Geofences | An app calls `addGeofences()` | Region coordinates, radii, transitions, and metadata are stored in Android SQLite or iOS `UserDefaults`. | Independent of `persist: false`. Call `removeGeofences()` (without identifiers to remove all) or `resetBackgroundLocation()`. |
| Native HTTP sync | An app explicitly supplies `sync.url` | Stored location payloads, configured headers, and `bodyTemplate` values go to the app-selected URL. No project URL is supplied. | `autoClear` removes successfully uploaded location records, not configuration, events, or geofences. The receiving service controls remote retention. |
| Forward and reverse geocoding | An app calls a geocoding API | The operating-system geocoder may contact Apple, Google, or another platform provider. | Governed by the platform service and the app's own handling of returned results. |
| Android debug logging | A debug build handles a background location | Debug logging is enabled by default and writes the exact latitude and longitude to the app's logcat stream under `NitroGeolocation`. Release builds disable verbose logs by default. | Governed by logcat access, collection tooling, and the app's log retention. Do not distribute debug builds or collect debug logs without treating them as precise-location data. |
| Prebuilt native artifacts | Native dependency installation/build | Gradle or CocoaPods may download a matching binary from this project's GitHub Releases. No end-user location is present in this build-time request. | Build-tool and package caches. Set `NITRO_GEOLOCATION_USE_PREBUILT=0` to build from source. |

Do not put long-lived secrets in `sync.headers` unless your threat model accepts
plain app-private preferences as storage. Prefer short-lived credentials and
TLS, and validate the configured URL before enabling sync. Android Auto Backup
and iOS device backup or transfer may include these stores unless the app's
backup policy excludes them. Test restore and deletion on every supported OS.

## Permissions and store disclosures

The host app owns permission prompts and the final merged declarations. Use
purpose-specific copy in iOS `Info.plist`, declare Android location permissions
for the access the app needs, and request permission from a user action.
Background access needs a separate, clear explanation.

The Android library manifest unconditionally merges these declarations into a
consumer: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`,
`RECEIVE_BOOT_COMPLETED`, `ACTIVITY_RECOGNITION`, and `WAKE_LOCK`, plus its
background services and receivers. They support the opt-in background,
start-on-boot, geofence, and activity-recognition APIs; they do not grant
location access by themselves. A foreground-only app that never imports or
calls the background entry point should remove every unused declaration with
Android manifest-merger markers and inspect the final merged manifest. For
example:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"
    tools:node="remove" />
  <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION"
    tools:node="remove" />

  <application>
    <receiver
      android:name="com.margelo.nitro.nitrogeolocation.background.NitroBootReceiver"
      tools:node="remove" />
    <!-- Remove the other Nitro background components the app does not use. -->
  </application>
</manifest>
```

Use the exact entries in the published library `AndroidManifest.xml` as the
removal checklist. Removing a permission or component while calling its feature
is unsupported. See Android's [manifest-merger marker reference](https://developer.android.com/build/manage-manifests#merge_rule_markers).

The iOS implementation uses `UserDefaults.standard` for app-private background
state. The SDK therefore ships `PrivacyInfo.xcprivacy` with
`NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1`; CocoaPods packages it
as the SDK's privacy resource, and release XCFrameworks include it in each
framework slice. This is the SDK's required-reason declaration, not a substitute
for the app's own manifest. Verify the manifest in the installed Pods resource
bundle or XCFramework and in Xcode's final privacy report. Apple does not allow
a third-party SDK to rely on the host manifest for its own required-reason API
use; see [Apple's required-reason guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).

Before release, reconcile the implementation with:

- the app's privacy notice and consent or lawful-basis flow;
- Apple App Privacy answers and any app-level `PrivacyInfo.xcprivacy` manifest;
- Google Play Data safety answers, foreground-service declarations, and the
  background-location review form when applicable;
- retention/deletion controls for on-device records and the app's sync server;
- child, health, workforce, precise-location, and regional rules applicable to
  the app.

The example app privacy manifest describes that app and cannot be copied
blindly into every consumer. Audit the final app and all dependencies together.

## Dependency and license disclosure

The published JavaScript package is MIT licensed and ships its `LICENSE`. It has
no direct npm runtime dependencies. Its peer dependencies are React, React
Native, and `react-native-nitro-modules`; the consumer chooses their resolved
versions.

Android always declares direct `implementation` dependencies on React Android,
the Kotlin standard library, the Nitro Modules project, Google Play Services
Base (default `18.5.0`), and Google Play Services Location (default `21.3.0`).
Consumers can override the Google versions with root-project ext properties
`playServicesBaseVersion` and `playServicesLocationVersion`, or Gradle properties
`NitroGeolocation_playServicesBaseVersion` and
`NitroGeolocation_playServicesLocationVersion`. iOS uses React/Nitro CocoaPods
dependencies plus Apple system frameworks; source and prebuilt installation
have different artifact provenance.

Do not treat an npm lockfile or final binary scan as a complete native dependency
inventory. Archive Gradle's resolved dependency report and verification
metadata, `Podfile.lock` (and `Package.resolved` when using SPM), prebuilt release
URL/checksum/provenance, and applicable license notices. Final AAB/APK/XCArchive
scanning is a useful cross-check, but generally cannot reconstruct original
Maven/CocoaPods coordinates, transitive graph, versions, or license obligations.

## Reproducible audit checklist

Run these from a clean checkout of the exact release commit:

```bash
yarn install --immutable
yarn pack:check
yarn npm audit --all --recursive
```

`pack:check` verifies the intended npm payload. The audit command checks the
resolved Yarn dependency graph against npm advisories; review findings rather
than suppressing them solely because they are development dependencies.

For an independent vulnerability scan of the committed lockfile, install
[OSV-Scanner](https://google.github.io/osv-scanner/installation/) and run:

```bash
osv-scanner scan -L yarn.lock
```

For a release SBOM, first create the same package archive that will be reviewed,
then scan both the archive and the final consumer app. For example, with
[Syft](https://github.com/anchore/syft):

```bash
mkdir -p artifacts
npm pack ./packages/react-native-nitro-geolocation --pack-destination artifacts
syft artifacts/react-native-nitro-geolocation-*.tgz \
  -o cyclonedx-json=artifacts/react-native-nitro-geolocation.cdx.json
```

Build a native SBOM from the recorded Gradle/CocoaPods resolution inputs, then
scan the final Android AAB/APK and iOS archive as a complementary artifact
check. Feed the resulting CycloneDX or SPDX documents into the organization's
license and vulnerability scanner, review unknown licenses manually, and
archive the resolution reports, SBOM, scanner version, advisory database
timestamp, and disposition with the release.

## Incident response

If a release changes a data flow, permission, default persistence behavior,
sync payload, or dependency, update this page and the app's disclosures before
shipping. Report suspected library security or privacy issues through the
[private security advisory form](https://github.com/jingjing2222/react-native-nitro-geolocation/security/advisories/new),
not a public issue containing user data.
