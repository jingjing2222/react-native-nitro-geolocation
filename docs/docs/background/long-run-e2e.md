# Long-Run Background E2E

The example app has two background E2E pages:

- `background-e2e` is a short smoke page for API contracts.
- `background-long-run` is a device-level page for long-running checks.

The long-run page reads native storage and status. It does not pass from React
state alone, so app restarts do not hide missing native delivery.

## Android

Run the Android emulator flow:

```sh
yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:android
```

This flow:

1. clears native storage and verifies both last native-record timestamps are absent,
2. starts background tracking with `stopOnTerminate: false` and `startOnBoot: true`,
3. registers a geofence,
4. establishes an outside foreground baseline, then arms a new proof marker,
5. sends the app home and injects inside, then outside locations,
6. reopens the page,
7. requires the injected inside coordinate followed by the outside coordinate, for both stored locations and location events, after the proof marker,
8. verifies `lastLocationAt` and `lastEventAt` are at or after that marker,
9. verifies the registered Headless task marked an inside event whose native measurement timestamp is after the marker,
10. verifies geofence enter and exit events after the marker,
11. stops tracking, removes geofences, and polls the native lifecycle briefly
    before failing cleanup if desired tracking, the actual foreground service,
    or a geofence remains active.

The prepare and arm registrations omit Android initial triggers, so the required
exit cannot be satisfied by the already-outside foreground baseline. Both
location payloads are matched to the exact injected coordinates, and the
outside row/event must have been stored after the matching inside row/event.

The Headless assertion proves handler delivery without an in-process background
listener. It does not terminate the React runtime or claim cold-start delivery.

To include reboot restore on an emulator:

```sh
RUN_REBOOT=1 yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:android
```

The reboot pass is emulator-only. The wrapper refuses `RUN_REBOOT=1` on a
physical Android device before issuing `adb reboot`, then arms a post-reboot
proof window, waits for `sys.boot_completed=1`, injects
outside/inside/outside locations after boot, and requires
the same ordered coordinates in both location rows and events using their
native measurement timestamps, plus ordered geofence events. Physical Android
devices need real movement or another trusted location injection setup.

## iOS

Run the iOS simulator flow:

```sh
yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:ios
```

This flow:

1. clears native storage and verifies both last native-record timestamps are absent,
2. starts iOS background/significant-change tracking and records an initial native location timestamp,
3. establishes an outside foreground baseline, then arms a new proof marker,
4. sends the app home and injects inside, then outside locations,
5. reopens the page,
6. requires stored geofence enter and exit events after the proof marker,
7. proves target-region enter-to-exit callback order with native transition timestamps,
8. verifies `lastEventAt` is at or after that marker,
9. stops tracking, removes geofences, and verifies cleanup from native status.

The Simulator does not reliably emit standard or significant-change location
rows after the app goes home. The iOS gate therefore uses region transitions,
which are native background callbacks, and does not claim that the injected
coordinates were retained as location rows. Real-device location delivery
remains a manual matrix item.

iOS does not have Android Headless JS or an Android-style boot receiver. The E2E
page reports those as platform limits instead of pretending they are supported.

## Manual Coordinates

The geofence is centered at:

```txt
37.5665,126.978
```

The deterministic transition path is:

```txt
outside: 37.563,126.97
inside:  37.5665,126.978
outside: 37.563,126.97
```

On iOS Simulator, use the Maestro flow for the Home/background step. For a
manual run, press Home in Simulator and inject the same path with:

```sh
xcrun simctl location booted set 37.563,126.97
xcrun simctl location booted start --interval=2 37.563,126.97 37.5665,126.978 37.563,126.97
```

On Android Emulator:

```sh
adb shell input keyevent HOME
adb emu geo fix 126.970 37.563
adb emu geo fix 126.978 37.5665
adb emu geo fix 126.970 37.563
```

## Expected Gaps

Long-run background behavior is platform and device-policy dependent. If the
screen reports a failed result, keep it failed and inspect the device state,
permissions, battery policy, and native logs. Do not change the E2E page to pass
without a stored native event.

The supported guarantees and the full automated/manual matrix are documented
in [Background Reliability Contract](/background/reliability-contract).
