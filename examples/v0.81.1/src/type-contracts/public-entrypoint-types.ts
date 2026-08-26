import type { NullableDouble } from "react-native-nitro-geolocation";
import type {
  AccuracyAuthorization as BackgroundAccuracyAuthorization,
  AndroidAccuracyPreset as BackgroundAndroidAccuracyPreset,
  AndroidGranularity as BackgroundAndroidGranularity,
  GeolocationCoordinates as BackgroundGeolocationCoordinates,
  GeolocationResponse as BackgroundGeolocationResponse,
  IOSAccuracyPreset as BackgroundIOSAccuracyPreset,
  LocationAccuracyOptions as BackgroundLocationAccuracyOptions,
  LocationError as BackgroundLocationError,
  LocationErrorCode as BackgroundLocationErrorCode,
  LocationProviderStatus as BackgroundLocationProviderStatus,
  LocationProviderUsed as BackgroundLocationProviderUsed,
  NullableDouble as BackgroundNullableDouble,
  PermissionStatus as BackgroundPermissionStatus
} from "react-native-nitro-geolocation/background";
import type {
  AndroidAccuracyPreset as CompatAndroidAccuracyPreset,
  AuthorizationLevel as CompatAuthorizationLevel,
  GeolocationCoordinates as CompatGeolocationCoordinates,
  IOSAccuracyPreset as CompatIOSAccuracyPreset,
  IOSActivityType as CompatIOSActivityType,
  LocationAccuracyOptions as CompatLocationAccuracyOptions,
  LocationProvider as CompatLocationProvider,
  NullableDouble as CompatNullableDouble
} from "react-native-nitro-geolocation/compat";

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
  Value
>() => Value extends Right ? 1 : 2
  ? true
  : false;
type Expect<Value extends true> = Value;

export type RootEntrypointTypeContract = Expect<
  Equal<NullableDouble, number | null>
>;

export type CompatEntrypointTypeContract = [
  CompatAndroidAccuracyPreset,
  CompatAuthorizationLevel,
  CompatGeolocationCoordinates,
  CompatIOSAccuracyPreset,
  CompatIOSActivityType,
  CompatLocationAccuracyOptions,
  CompatLocationProvider,
  CompatNullableDouble
];

export type BackgroundEntrypointTypeContract = [
  BackgroundAccuracyAuthorization,
  BackgroundAndroidAccuracyPreset,
  BackgroundAndroidGranularity,
  BackgroundGeolocationCoordinates,
  BackgroundGeolocationResponse,
  BackgroundIOSAccuracyPreset,
  BackgroundLocationAccuracyOptions,
  BackgroundLocationError,
  BackgroundLocationErrorCode,
  BackgroundLocationProviderStatus,
  BackgroundLocationProviderUsed,
  BackgroundNullableDouble,
  BackgroundPermissionStatus
];
