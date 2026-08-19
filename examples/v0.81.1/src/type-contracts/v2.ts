// @ts-expect-error v2 removes the duplicate Modern configuration alias.
import type { ModernGeolocationConfiguration } from "react-native-nitro-geolocation";
import type {
  LocationRequestOptions,
  LocationSettingsOptions,
  LocationRequest as MergedLocationRequest
} from "react-native-nitro-geolocation";
import { selectProvider } from "react-native-nitro-geolocation";
import type { GeolocationOptions as CompatGeolocationOptions } from "react-native-nitro-geolocation/compat";

void (undefined as unknown as ModernGeolocationConfiguration);

const modernRequest: LocationRequestOptions = {
  // @ts-expect-error v2 Modern callers choose an explicit accuracy preset.
  enableHighAccuracy: true
};

const modernSettings: LocationSettingsOptions = {
  // @ts-expect-error v2 Modern settings use accuracy.android.
  enableHighAccuracy: true
};

const compatRequest: CompatGeolocationOptions = {
  enableHighAccuracy: true
};

const mergedRequest: MergedLocationRequest = {
  accuracy: "high",
  distanceFilter: 10
};

const legacyMergedRequest: MergedLocationRequest = {
  // @ts-expect-error v2 advanced utilities use an explicit accuracy level.
  enableHighAccuracy: true,
  distanceFilter: 10
};

selectProvider("high", true, true);
// @ts-expect-error v2 advanced provider selection uses an explicit accuracy preset.
selectProvider(true, true, true);

void [
  modernRequest,
  modernSettings,
  compatRequest,
  mergedRequest,
  legacyMergedRequest
];
