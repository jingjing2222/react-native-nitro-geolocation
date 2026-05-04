import type {
  ModernGeolocationConfiguration as NativeGeolocationConfiguration,
  NitroGeolocation
} from "./NitroGeolocation.nitro";
import type {
  NitroGeolocationCompat,
  RNConfigurationInternal
} from "./NitroGeolocationCompat.nitro";

type CallbackValue<TCallback> = TCallback extends (value: infer Value) => void
  ? Value
  : never;

type CompatGetCurrentPosition = NitroGeolocationCompat["getCurrentPosition"];
type CompatSuccessCallback = Parameters<CompatGetCurrentPosition>[0];
type CompatErrorCallback = NonNullable<Parameters<CompatGetCurrentPosition>[1]>;
type NativeLocationProvider = NonNullable<
  NativeGeolocationConfiguration["locationProvider"]
>;

export type GeolocationResponse = Awaited<
  ReturnType<NitroGeolocation["getCurrentPosition"]>
>;

export type CompatGeolocationResponse = CallbackValue<CompatSuccessCallback>;

export type GeolocationCoordinates = GeolocationResponse["coords"];
export type LocationProviderUsed = NonNullable<GeolocationResponse["provider"]>;
export type CompatGeolocationError = CallbackValue<CompatErrorCallback>;
export type CompatGeolocationOptions = NonNullable<
  Parameters<CompatGetCurrentPosition>[2]
>;

export type AuthorizationLevel = NonNullable<
  NativeGeolocationConfiguration["authorizationLevel"]
>;
export type LocationProvider =
  | Exclude<NativeLocationProvider, "android_platform">
  | "android";

export type GeolocationConfiguration = Omit<
  NativeGeolocationConfiguration,
  "locationProvider"
> & {
  locationProvider?: LocationProvider;
};

export type CompatGeolocationConfiguration = Omit<
  RNConfigurationInternal,
  "locationProvider"
> & {
  locationProvider?: LocationProvider;
};
