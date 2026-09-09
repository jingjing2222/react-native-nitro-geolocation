# 2.0.0 release audit

Baseline: `879a562` (main, package `2.0.0-rc.5`). Audit date: 2026-09-09.
This report records concrete checks and remaining release gates; it does not
promise that every device, OS policy, or application integration is defect-free.

## Corrections found during this audit

| Area | Defect | Correction and evidence |
| --- | --- | --- |
| iOS first authorization | Initial `notDetermined` delegate notification consumed pending permission callbacks | Main-thread permission queue retains them until a decision; Swift contract covers initial notification, concurrent callers, and reentrancy |
| iOS provider observation | Lazy watcher initialization could run on JS and main threads | Eager immutable watcher instance |
| Cancellation | Startup throws left abort listeners active; teardown throws left promises pending | Native/browser regression tests reproduce both failures and verify settlement plus late-result suppression |
| React and web watch lifecycle | Queued callbacks updated stopped/replaced subscriptions; synchronous StrictMode replay lost a result | Real React renderer lifecycle tests and browser ownership/cleanup tests |
| Android foreground notification | `notificationColor` and `stopActionTitle` were ignored | Native action with immutable, generation-specific intent; Robolectric verifies color, stale action isolation, preserving a newer run's restart policy, and stopping without promotion/restart |
| Background acquisition | iOS ignored requested accuracy; Android ignored requested granularity | Honor the configured native acquisition settings; Android request contract tests |
| Background persistence | Android conflated absent and explicit-zero storage caps, changed default stop-on-still after restart; iOS omitted accuracy when restoring | Preserve policies; Android cold-store reconstruction tests; source Release builds |
| Geofencing defaults | Android ignored configured geofencing defaults and lost them across restart | Apply defaults with per-field registration overrides, persist them, and use them for native restoration; JVM round-trip/override contract |
| Numeric options | iOS numeric-to-integer conversions could trap; Android retries could overflow into zero attempts | Validate foreground numbers and retry counts, bound storage conversions; Swift/JVM contracts |
| Public contract | iOS deferred delivery options were stored but never implemented | Remove them from the 2.0 public facade and snapshots, retain internal serialization compatibility, document the RC breaking correction and type-test it |
| GA documentation | Versioning skipped navigation JSON, left RC prose, and retained 1.x as default | Rehearse a real 2.0 build in an isolated copy; verify current routes, legacy archive, and Cloudflare redirects |
| CI decision | Two distinct jobs published the same `Unit Tests` name, allowing summary views to show success while Android was still running | Unique suite names and one compatibility-preserving aggregate gate; regression tests exercise success, failure, cancellation, and skip combinations |
| Toolchain security | Production trees contained 117 advisory/deprecation records; an expanded development sweep found another critical XML-parser issue | Earlier refreshes left 42 production-tree / 43 all-environment records. The 2026-09-10 registry recheck and Vitest/TOML fixes leave 43 / 44 records, zero critical; [remaining upstream/toolchain risks](./release-audit-dependencies-2.0.0.md), including another unpatched extract-zip advisory, are explicitly not marked fixed |

## Roadmap and compatibility review

[Roadmap #98](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/98)
was compared with exported APIs, implementation, type contracts, unit tests,
native contract scripts, and the consumer E2E suites.

- Readiness, detailed permissions, deterministic settings, cancellation, provider
  observation, watch introspection, quality metadata, compat metadata, install
  doctor, Expo plugin, lifecycle events, and unified background events are present.
- The seven previously documented 2.0 changes remain intact. This audit adds the
  removal of inert deferred-delivery options as the eighth migration item.
- `/compat` retains numeric errors and `enableHighAccuracy`; the main API uses
  string errors and explicit accuracy. Sync cache and async platform-cache APIs
  remain distinct, and provider tokens remain outside position/heading snapshots.
- [#206](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/206)
  requests a 1.4.3 crash backport. 2.x already confines foreground mutable state to
  main; this PR additionally fixes first-decision handling and watcher creation.
  A separate 1.x backport is not part of this 2.0 PR.
- [#195](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/195)
  is implemented by [#211](https://github.com/jingjing2222/react-native-nitro-geolocation/pull/211):
  native `watchProviderStatus` snapshots include optional `authorizationStatus`
  and deliver permission-only changes. Web and older stored snapshots omit this
  field. Android can terminate the app on revocation, so applications must
  subscribe again on launch; no uninterrupted revocation callback is promised.
- [#207](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/207)
  is implemented by [#212](https://github.com/jingjing2222/react-native-nitro-geolocation/pull/212):
  Android notification actions emit `notificationAction` events through live
  listeners, persisted recovery when enabled, and Headless JS. Applications
  decide each action's behavior. The total is limited to three buttons including
  the native stop action; iOS and web do not provide this feature.
- Native peer ranges declare more combinations than the continuously tested
  RN 0.81.1 / Nitro 0.35.10 reference stack. RN 0.87 SwiftPM with Nitro 0.37.1
  remains experimental; no broader test coverage is implied.

## Final documentation and roadmap review — 2026-09-10

This follow-up's dates use Asia/Seoul (UTC+09:00); its 2026-09-10 checks ran
on 2026-09-09 UTC. They describe completed checks, not future scheduled work.

The follow-up review integrates `75054a6` (`2.0.0-rc.6`) and includes the
authorization and notification-action additions above. The validation ledger
below records the earlier audit; it is not a claim that its device runs were
repeated after every follow-up change. Final merged-code checks belong in the
follow-up PR and release PR.

The remaining iOS accuracy lookup evaluated `self.locationManager` on the
Promise worker before its helper dispatched to main. The follow-up defers the
property evaluation itself. Its native regression calls the production helper
from worker threads, checks the property getter and Core Location read execute
on main, and exercises 2,000 concurrent state/permission operations and
reentrant callbacks. The focused contract also passes Thread Sanitizer.

Android authorization regression coverage now reads production provider
snapshots from denied, approximate-only foreground, and background permission
states. It drives `MODE_FOREGROUND`/`MODE_ALLOWED` changes on the existing
location AppOp and verifies `whenInUse` → `always` → `whenInUse` delivery without
a provider broadcast, plus the pre-Android-10 mapping. The suggested separate
`OPSTR_BACKGROUND_LOCATION` does not exist in the
[Android AppOps API](https://developer.android.com/reference/android/app/AppOpsManager);
no unsupported operation constant was added.

| Roadmap #98 scope | Implementation and review evidence |
| --- | --- |
| Readiness, detailed permissions, Android settings | Public `getLocationReadiness`, `getPermissionDetails`, and `requestLocationSettingsDetailed`; API tests and documented result/remediation types |
| Cancellation, provider observation, watch introspection | `CurrentPositionOptions.signal`, `watchProviderStatus`, and `getActiveWatches`; cancellation/lifecycle tests, native watcher contracts, and watch-observability guide |
| Background reliability and iOS lifecycle | Reliability contract and long-run matrix; `onLocationLifecycleChange` filters the unified stream; lifecycle persistence and delegate contracts |
| Quality and integrity metadata | `LocationMetadata` and opt-in compat metadata; metadata tests and consumer type contracts preserve the default compat shape |
| Offline recipes and consumer verification | GPS/offline recipe, consumer E2E contract kit, and compatibility matrix document the supported boundaries |
| Install doctor and Expo opt-in plugin | Packaged doctor executable, `app.plugin.js`, doctor/plugin tests, and Expo development-build guide; no postinstall mutation |
| Privacy and compliance | Privacy guide, native privacy manifest, dependency disclosure, and separate dependency audit with unresolved findings |
| Selected 2.0 breaking changes | Main errors, removed configuration alias, explicit accuracy, split last-known reads, deterministic settings, per-watch semantics, and unified events are represented in public APIs, migration docs, and type/native contracts |
| Release preparation | Versioned 1.x archive and mirrored 2.x sources, experimental SwiftPM guide, and RC publication history; stable publication and prebuilt verification remain separate release steps |

[Roadmap #92](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/92)
contains historical claims that should not be used as the 2.0 contract. Its
unchecked Expo guidance is now covered by the development-build guide and
opt-in plugin. Its initial exclusion of `/compat` web support was superseded by
the browser fallback. Its completed deferred-updates item was inaccurate:
those options never reached Core Location and were removed from the 2.0 public
facade, as documented in the eighth migration item. No selected #98 feature was
found missing in this source and documentation review.

The final documentation correction also covers `notificationAction` in
exhaustive event handling and stored recovery. Provider snapshots remain
live-only; migration instructions must not tell consumers to drain a stored
provider event. Stable-version synchronization now updates onboarding policy
and installation prose as well as commands, while leaving RC documentation
unchanged until versioning exits prerelease mode. Stable install commands pin
the exact release in both READMEs and current documentation, so a staged
`ga-candidate` release cannot accidentally install the older `latest` version.
Subsequent stable releases update those pins. The 1.x archive remains untouched.

## Repository-control preflight

Read-only GitHub checks during this audit found no legacy protection on `main`,
a `main` ruleset with enforcement disabled, and no configured environments.
The promotion workflow names `npm-latest`, but a YAML environment name alone
does not supply required reviewers or deployment restrictions. Configure these
repository controls before relying on automatic merge/approval gates.

The repository has an `NPM_TOKEN` secret name. Its value, validity, scope, and
expiry were not inspected or verified by publication. No repository protection,
environment, or secret setting was changed by this PR.

## Verification ledger

Completed locally during implementation:

- Baseline: 202 JavaScript tests and 18 release/SwiftPM contract tests.
- Updated JavaScript, React lifecycle, and browser contracts: 213 tests passing.
- Release/SwiftPM/CI-gate contracts: 21 tests passing.
- Android JVM/Robolectric suite: final counts are recorded in the PR validation
  ledger; arm64 Release APK builds pass. Numeric regressions include nonfinite,
  fractional, subnormal, and huge storage caps with cold-store reconstruction.
- iOS Swift lifecycle, permission, watch delivery, and numeric contracts: passing.
- iOS CocoaPods source Release simulator build: passing.
- Complete workspace typecheck, package build, dead-code checks, package dry-run,
  source-size checks, and install doctor: passing during implementation.
- iOS prebuilt checksum tests: 4 tests / 12 assertions, passing.
- Isolated 2.0 documentation transition: 42 mirrored sources and 24 routes pass.
- Actual Changesets 3 rehearsal in a detached temporary worktree: `pre exit`,
  `version`, source synchronization, real docs build, source/route checks, and
  npm package dry-run pass. It produces exactly `2.0.0` (583 package files).
- Android prebuilt checksums: valid downloads/cache reuse, tampered cache,
  checksum mismatch, and invalid-checksum fallback tests pass.
- Rozenite behavior E2E: 10/10 cases passing, including after dependency refresh.
- Native E2E uses the RN 0.81.1 source Release application on an Android API 34
  arm64 emulator and an iOS 26.5 simulator. Full native suites, final-build
  background configuration checks, background long-run/reboot, GPS-offline,
  web fallback, and no-Headless-JS regression results are tracked in the
  [PR #208 validation ledger](https://github.com/jingjing2222/react-native-nitro-geolocation/pull/208).
  The PR ledger and checks are the authority for their final pass/fail state;
  this document does not mark an unfinished run as passed.

## Release gates after merging

1. Complete PR checks and the recorded E2E runs; inspect any failed scenarios.
   Enable the intended required checks/repository rules and configure protection
   for the `npm-latest` environment if approval-gated promotion is required.
2. Exit Changesets prerelease mode and generate the exact `2.0.0` version commit
   with `yarn release:version`. Review the resulting package/docs/lockfile diff.
3. Publish through the repository release workflow. Stable packages are staged
   under `ga-candidate`, not sent directly to `latest`.
4. Build and verify matching 2.0.0 Android, CocoaPods iOS, and SwiftPM release
   assets and checksums, then run the `promote-latest` workflow for `2.0.0`.
5. Physical-device background delivery, OEM restrictions, battery behavior,
   reduced/approximate permissions, and real heading/provider selection remain
   device acceptance gates. Simulator success does not replace these checks.
6. Review the separate dependency audit before treating the contributor/CI
   environment as security-cleared; its remaining 44 records are not suppressed.

No npm publication or `latest` promotion is performed by this audit PR.
