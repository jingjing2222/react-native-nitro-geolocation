import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const plugin = require("../app.plugin.js") as {
  (config: Record<string, unknown>): Record<string, unknown>;
  applyAndroidManifest: (
    manifest: Record<string, unknown>,
    options?: { enableBackgroundLocation?: boolean }
  ) => Record<string, unknown>;
  applyInfoPlist: (
    infoPlist: Record<string, unknown>,
    options?: {
      enableBackgroundLocation?: boolean;
      locationAlwaysAndWhenInUsePermission?: string;
      locationWhenInUsePermission?: string;
    }
  ) => Record<string, unknown>;
};

function androidPermissionNames(manifest: Record<string, unknown>) {
  return (
    manifest["uses-permission"] as Array<{
      $: { "android:name": string };
    }>
  ).map((permission) => permission.$["android:name"]);
}

describe("opt-in Expo config plugin", () => {
  it("registers Android and iOS mods only when the plugin is invoked", () => {
    const config = plugin({ name: "Fixture", slug: "fixture" });

    expect(config).toHaveProperty("mods.android.manifest");
    expect(config).toHaveProperty("mods.ios.infoPlist");
  });

  it("adds only missing foreground permissions and preserves app-owned values", () => {
    const manifest = {
      "uses-permission": [
        {
          $: {
            "android:maxSdkVersion": "30",
            "android:name": "android.permission.ACCESS_COARSE_LOCATION",
            "tools:node": "remove"
          }
        },
        { $: { "android:name": "com.example.CUSTOM" } }
      ]
    };
    const infoPlist = {
      NSLocationWhenInUseUsageDescription: "Keep the app's existing copy."
    };

    plugin.applyAndroidManifest(manifest);
    plugin.applyAndroidManifest(manifest);
    plugin.applyInfoPlist(infoPlist);

    expect(androidPermissionNames(manifest)).toEqual([
      "android.permission.ACCESS_COARSE_LOCATION",
      "com.example.CUSTOM",
      "android.permission.ACCESS_FINE_LOCATION"
    ]);
    expect(
      (manifest["uses-permission"] as Array<{ $: Record<string, string> }>)[0].$
    ).toEqual({
      "android:name": "android.permission.ACCESS_COARSE_LOCATION"
    });
    expect(infoPlist.NSLocationWhenInUseUsageDescription).toBe(
      "Keep the app's existing copy."
    );
  });

  it("configures explicit background access idempotently", () => {
    const manifest: Record<string, unknown> = {};
    const infoPlist: Record<string, unknown> = {};
    const options = {
      enableBackgroundLocation: true,
      locationWhenInUsePermission: "Use location for nearby deliveries.",
      locationAlwaysAndWhenInUsePermission:
        "Use location to continue an active delivery."
    };

    plugin.applyAndroidManifest(manifest, options);
    plugin.applyAndroidManifest(manifest, options);
    plugin.applyInfoPlist(infoPlist, options);
    plugin.applyInfoPlist(infoPlist, options);

    expect(new Set(androidPermissionNames(manifest))).toEqual(
      new Set([
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.POST_NOTIFICATIONS"
      ])
    );
    expect(androidPermissionNames(manifest)).toHaveLength(6);
    expect(infoPlist).toMatchObject({
      NSLocationWhenInUseUsageDescription:
        "Use location for nearby deliveries.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Use location to continue an active delivery.",
      UIBackgroundModes: ["location"]
    });
  });

  it("rejects empty permission copy instead of generating an invalid app", () => {
    expect(() =>
      plugin.applyInfoPlist({}, { locationWhenInUsePermission: "  " })
    ).toThrow("locationWhenInUsePermission must be a non-empty string");
    expect(() =>
      plugin.applyInfoPlist(
        {},
        {
          enableBackgroundLocation: true,
          locationAlwaysAndWhenInUsePermission: ""
        }
      )
    ).toThrow(
      "locationAlwaysAndWhenInUsePermission must be a non-empty string"
    );
  });

  it("rejects a string background flag instead of enabling sensitive permissions", () => {
    expect(() =>
      plugin.applyAndroidManifest({}, {
        enableBackgroundLocation: "false"
      } as unknown as {
        enableBackgroundLocation?: boolean;
      })
    ).toThrow("enableBackgroundLocation must be a boolean");
    expect(() =>
      plugin.applyInfoPlist({}, {
        enableBackgroundLocation: "true"
      } as unknown as {
        enableBackgroundLocation?: boolean;
      })
    ).toThrow("enableBackgroundLocation must be a boolean");
  });
});
