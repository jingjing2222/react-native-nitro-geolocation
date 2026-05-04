import type {
  ModernGeolocationConfiguration as NativeModernGeolocationConfiguration,
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
  NativeModernGeolocationConfiguration["locationProvider"]
>;

export type ModernGeolocationResponse = Awaited<
  ReturnType<NitroGeolocation["getCurrentPosition"]>
>;

export type CompatGeolocationResponse = CallbackValue<CompatSuccessCallback>;

export type GeolocationCoordinates = ModernGeolocationResponse["coords"];
export type LocationProviderUsed = NonNullable<
  ModernGeolocationResponse["provider"]
>;
export type GeolocationError = CallbackValue<CompatErrorCallback>;
export type GeolocationOptions = NonNullable<
  Parameters<CompatGetCurrentPosition>[2]
>;

export type AuthorizationLevel = NonNullable<
  NativeModernGeolocationConfiguration["authorizationLevel"]
>;
export type LocationProvider =
  | Exclude<NativeLocationProvider, "android_platform">
  | "android";

export type ModernGeolocationConfiguration = Omit<
  NativeModernGeolocationConfiguration,
  "locationProvider"
> & {
  locationProvider?: LocationProvider;
};

export type GeolocationConfiguration = Omit<
  RNConfigurationInternal,
  "locationProvider"
> & {
  locationProvider?: LocationProvider;
};
