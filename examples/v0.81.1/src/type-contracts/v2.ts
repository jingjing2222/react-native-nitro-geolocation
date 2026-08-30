import type {
  LocationReadiness,
  LocationReadinessRemediation,
  LocationRequestOptions,
  LocationSettingsOptions,
  LocationSettingsOutcome,
  LocationSettingsResult,
  LocationRequest as MergedLocationRequest
} from "react-native-nitro-geolocation";
import {
  getLocationReadiness,
  requestLocationSettings,
  requestLocationSettingsDetailed,
  selectProvider
} from "react-native-nitro-geolocation";
import type { GeolocationOptions as CompatGeolocationOptions } from "react-native-nitro-geolocation/compat";

const request: LocationRequestOptions = {
  // @ts-expect-error v2 callers choose an explicit accuracy preset.
  enableHighAccuracy: true
};

const settings: LocationSettingsOptions = {
  // @ts-expect-error v2 settings use accuracy.android.
  enableHighAccuracy: true
};

const settingsResultPromise: Promise<LocationSettingsResult> =
  requestLocationSettings();
const detailedSettingsResultPromise: Promise<LocationSettingsResult> =
  requestLocationSettingsDetailed();
const settingsOutcome: LocationSettingsOutcome = "activityMissing";

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

const readinessPromise: Promise<LocationReadiness> = getLocationReadiness();
const readinessRemediation: LocationReadinessRemediation = "requestPermission";

selectProvider("high", true, true);
// @ts-expect-error v2 advanced provider selection uses an explicit accuracy preset.
selectProvider(true, true, true);

void [
  request,
  settings,
  settingsResultPromise,
  detailedSettingsResultPromise,
  settingsOutcome,
  compatRequest,
  mergedRequest,
  legacyMergedRequest,
  readinessPromise,
  readinessRemediation
];
