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
| Background location | An app calls `startBackgroundLocation()` | Location records and enabled background events are processed by the native app. | Records are stored on device by default unless `persist: false`; configure `maxStoredLocations` and `maxStoredEvents`, then clear records with the storage APIs. |
| Native HTTP sync | An app explicitly supplies `sync.url` | Stored location payloads, configured headers, and `bodyTemplate` values go to the app-selected URL. No project URL is supplied. | `autoClear` and the app's storage calls control local cleanup; the receiving service controls remote retention. |
| Forward and reverse geocoding | An app calls a geocoding API | The operating-system geocoder may contact Apple, Google, or another platform provider. | Governed by the platform service and the app's own handling of returned results. |
| Prebuilt native artifacts | Native dependency installation/build | Gradle or CocoaPods may download a matching binary from this project's GitHub Releases. No end-user location is present in this build-time request. | Build-tool and package caches. Set `NITRO_GEOLOCATION_USE_PREBUILT=0` to build from source. |

Do not put long-lived secrets in `sync.headers` unless your threat model accepts
native app configuration storage. Prefer short-lived credentials and TLS, and
validate the configured URL before enabling sync.

## Permissions and store disclosures

The host app owns all permission prompts and declarations. Use purpose-specific
copy in iOS `Info.plist`; declare only the Android foreground/background
permissions the app actually needs; and request permission from a user action.
Background access needs a separate, clear explanation.

Before release, reconcile the implementation with:

- the app's privacy notice and consent or lawful-basis flow;
- Apple App Privacy answers and any app-level `PrivacyInfo.xcprivacy` manifest;
- Google Play Data safety answers, foreground-service declarations, and the
  background-location review form when applicable;
- retention/deletion controls for on-device records and the app's sync server;
- child, health, workforce, precise-location, and regional rules applicable to
  the app.

The example app privacy manifest is an example for that app, not a declaration
that can be copied blindly into every consumer. Audit the final app and all of
its dependencies together.

## Dependency and license disclosure

The published JavaScript package is MIT licensed and ships its `LICENSE`. It has
no direct npm runtime dependencies. Its peer dependencies are React, React
Native, and `react-native-nitro-modules`; the consumer chooses their resolved
versions. Native builds also use React Native platform artifacts, Nitro Modules,
Apple system frameworks, Android platform APIs, and Google Play Services
location on Android where configured by the build.

Treat the resolved app lockfile and final native artifacts as the auditable
inventory. A package manifest alone cannot disclose transitive dependencies
selected by the consuming app. Preserve third-party notices required by the
versions and binaries you actually ship.

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

Also produce an SBOM from the final Android AAB/APK and iOS archive because
those artifacts contain the consumer's resolved native dependency graph. Feed
the resulting CycloneDX or SPDX document into the organization's license and
vulnerability scanner, review unknown licenses manually, and archive the SBOM,
scanner version, advisory database timestamp, and disposition with the release.

## Incident response

If a release changes a data flow, permission, default persistence behavior,
sync payload, or dependency, update this page and the app's disclosures before
shipping. Report suspected library security or privacy issues through the
[private security advisory form](https://github.com/jingjing2222/react-native-nitro-geolocation/security/advisories/new),
not a public issue containing user data.
