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

1. starts background tracking with `stopOnTerminate: false` and `startOnBoot: true`,
2. registers a geofence,
3. sends the app home,
4. injects outside, inside, and outside locations,
5. reopens the page,
6. verifies stored background location events recorded after the run marker,
7. verifies Headless JS delivery by checking delivered native event flags,
8. verifies geofence enter and exit events.

To include reboot restore on an emulator:

```sh
RUN_REBOOT=1 yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:android
```

The reboot pass is emulator-only. The wrapper refuses `RUN_REBOOT=1` on a
physical Android device before issuing `adb reboot`, then arms a post-reboot
proof window, injects outside/inside/outside locations after boot, and requires
post-reboot location plus geofence events. Physical Android devices need real
movement or another trusted location injection setup.

## iOS

Run the iOS simulator flow:

```sh
yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:ios
```

This flow:

1. starts iOS background/significant-change tracking,
2. sends the app home,
3. injects location changes,
4. reopens the page,
5. verifies native storage drain from events recorded after the run marker.

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
