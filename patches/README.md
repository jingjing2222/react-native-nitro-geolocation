# iOS first-launch crash on 1.4.3

[Issue #206](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/206)
reports a race between JS calls and Core Location's initial authorization
callback. The 2.0 implementation confines request and subscription state to the
main queue. Apps staying on **exactly 1.4.3** can apply the adjacent
`react-native-nitro-geolocation+1.4.3.patch` until a patched 1.x release is available.
This patch does not require adopting the 2.0 API.

1. Copy that patch into your app's `patches/` directory.
2. Install `patch-package` as a development dependency using your package manager.
3. Add `patch-package` to your `postinstall` script, preserving any existing steps,
   and run it once to patch the installed package.
4. Rebuild the iOS application from source. Disable any cached/prebuilt copy of
   the native library so the patched Swift source is compiled.

The patch queues mutable location/heading operations on the main queue, including
manager creation, configuration, request registration, and cleanup. Tokens still
return synchronously, while registration and removal retain queue order. It also
keeps temporary-accuracy manager access on main and ignores the initial
`notDetermined` callback while a permission request is pending. It does not modify
Android or the package's JavaScript API.

Run `bash scripts/test-ios-143-backport.sh` from this repository to verify the
patch against the published npm archive and parse the resulting Swift source.
That check requires npm, network access, and Xcode. Run the native stress contract
with `bash scripts/test-ios-location-lifecycle.sh`.

For device verification, enable Thread Sanitizer, reset location permissions,
and exercise concurrent permission, current-position, heading, and immediate
watch/unwatch calls on first launch. Repeat with permission allowed and denied.
Remove this version-specific patch when upgrading to a fixed release.
