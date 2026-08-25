const {
  withAndroidManifest,
  withInfoPlist
} = require("expo/config-plugins");

const FOREGROUND_PERMISSIONS = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION"
];

const BACKGROUND_PERMISSIONS = [
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.POST_NOTIFICATIONS"
];

const DEFAULT_WHEN_IN_USE_PERMISSION =
  "Allow $(PRODUCT_NAME) to access your location while you use the app.";
const DEFAULT_ALWAYS_PERMISSION =
  "Allow $(PRODUCT_NAME) to access your location during active background features.";

function validatePermissionOption(name, value) {
  if (value !== undefined && (typeof value !== "string" || !value.trim())) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function validateBackgroundOption(value) {
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error("enableBackgroundLocation must be a boolean");
  }
}

function ensureAndroidPermission(manifest, name) {
  const permissions = Array.isArray(manifest["uses-permission"])
    ? manifest["uses-permission"]
    : [];
  let found = false;
  const nextPermissions = [];

  for (const permission of permissions) {
    if (permission?.$?.["android:name"] !== name) {
      nextPermissions.push(permission);
      continue;
    }
    if (found) continue;
    found = true;
    const attributes = { ...permission.$ };
    delete attributes["android:maxSdkVersion"];
    delete attributes["tools:node"];
    nextPermissions.push({ ...permission, $: attributes });
  }

  if (!found) nextPermissions.push({ $: { "android:name": name } });
  manifest["uses-permission"] = nextPermissions;
}

function applyAndroidManifest(manifest, options = {}) {
  validateBackgroundOption(options.enableBackgroundLocation);
  const permissions = options.enableBackgroundLocation === true
    ? [...FOREGROUND_PERMISSIONS, ...BACKGROUND_PERMISSIONS]
    : FOREGROUND_PERMISSIONS;
  for (const permission of permissions) {
    ensureAndroidPermission(manifest, permission);
  }
  return manifest;
}

function applyInfoPlist(infoPlist, options = {}) {
  validateBackgroundOption(options.enableBackgroundLocation);
  validatePermissionOption(
    "locationWhenInUsePermission",
    options.locationWhenInUsePermission
  );
  validatePermissionOption(
    "locationAlwaysAndWhenInUsePermission",
    options.locationAlwaysAndWhenInUsePermission
  );

  infoPlist.NSLocationWhenInUseUsageDescription =
    options.locationWhenInUsePermission ||
    (typeof infoPlist.NSLocationWhenInUseUsageDescription === "string" &&
    infoPlist.NSLocationWhenInUseUsageDescription.trim()
      ? infoPlist.NSLocationWhenInUseUsageDescription
      : DEFAULT_WHEN_IN_USE_PERMISSION);

  if (options.enableBackgroundLocation === true) {
    infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
      options.locationAlwaysAndWhenInUsePermission ||
      (typeof infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription ===
        "string" &&
      infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription.trim()
        ? infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription
        : DEFAULT_ALWAYS_PERMISSION);
    const modes = Array.isArray(infoPlist.UIBackgroundModes)
      ? infoPlist.UIBackgroundModes
      : [];
    infoPlist.UIBackgroundModes = [...new Set([...modes, "location"])];
  }

  return infoPlist;
}

function withNitroGeolocation(config, options = {}) {
  const withAndroid = withAndroidManifest(config, (androidConfig) => {
    applyAndroidManifest(androidConfig.modResults.manifest, options);
    return androidConfig;
  });
  return withInfoPlist(withAndroid, (iosConfig) => {
    applyInfoPlist(iosConfig.modResults, options);
    return iosConfig;
  });
}

module.exports = withNitroGeolocation;
module.exports.applyAndroidManifest = applyAndroidManifest;
module.exports.applyInfoPlist = applyInfoPlist;
