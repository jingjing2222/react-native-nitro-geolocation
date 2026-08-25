import { LocationErrorCodes } from "../src";
import type {
  CurrentPositionOptions,
  GeolocationConfiguration,
  LastKnownPositionOptions,
  LocationAvailability,
  LocationAvailabilityReason,
  LocationError,
  LocationErrorCode as LocationErrorCodeType,
  LocationRequestOptions,
  LocationSettingsOptions,
  PermissionStatus,
  UseWatchPositionResult
} from "../src";
import type {
  GeolocationConfiguration as NativeGeolocationConfiguration,
  LocationError as NativeLocationError,
  LocationProvider as NativeLocationProvider,
  LocationRequestOptions as NativeLocationRequestOptions,
  LocationSettingsOptions as NativeLocationSettingsOptions,
  PermissionStatus as NativePermissionStatus
} from "../src/NitroGeolocation.nitro";
import type {
  CompatGeolocationConfigurationInternal,
  LocationProviderInternal
} from "../src/NitroGeolocationCompat.nitro";
import type {
  AndroidBackgroundProvider,
  BackgroundActivityEvent,
  BackgroundGeofenceEvent,
  BackgroundLocationDiagnosis,
  StartActivityRecognitionOptions
} from "../src/background";
import type {
  BackgroundActivityEventEnvelope as NativeBackgroundActivityEvent,
  BackgroundGeofenceEventEnvelope as NativeBackgroundGeofenceEvent
} from "../src/background/types";
import type { CompatGeolocationConfiguration } from "../src/publicTypes";
import type { LocationAvailability as NativeLocationAvailability } from "../src/types";

// @ts-expect-error Nitro's nullable bridge envelope is not a public API type.
import type { BackgroundEventEnvelope } from "../src/background";
// @ts-expect-error Nitro's stored bridge envelope is not a public API type.
import type { StoredBackgroundEventEnvelope } from "../src/background";

type _BackgroundEventEnvelopeMustStayPrivate = BackgroundEventEnvelope;
type _StoredBackgroundEventEnvelopeMustStayPrivate =
  StoredBackgroundEventEnvelope;

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
  Value
>() => Value extends Right ? 1 : 2
  ? true
  : false;
type Expect<Value extends true> = Value;
type Simplify<Value> = { [Key in keyof Value]: Value[Key] };

type _LocationErrorUsesPublicCode = Expect<
  Equal<LocationError["code"], LocationErrorCodeType>
>;
type _LocationErrorMatchesNativeContract = Expect<
  Equal<LocationError, NativeLocationError>
>;
type _LocationErrorCodeIsExact = Expect<
  Equal<
    LocationErrorCodeType,
    | "internalError"
    | "permissionDenied"
    | "positionUnavailable"
    | "timeout"
    | "playServicesUnavailable"
    | "settingsNotSatisfied"
  >
>;
type _LocationAvailabilityReasonIsExact = Expect<
  Equal<
    LocationAvailabilityReason,
    | "unsupported"
    | "permissionUndetermined"
    | "permissionDenied"
    | "permissionRestricted"
    | "locationServicesDisabled"
    | "providerUnavailable"
    | "temporarilyUnavailable"
    | "authorizationUnknown"
    | "unknown"
  >
>;
type _LocationAvailabilityUsesPublicReason = Expect<
  Equal<LocationAvailability["reason"], LocationAvailabilityReason | undefined>
>;
type _NativeAvailabilityWireShapeIsUnchanged = Expect<
  Equal<NativeLocationAvailability["reason"], string | undefined>
>;
type _PermissionStatusMatchesNativeContract = Expect<
  Equal<PermissionStatus, NativePermissionStatus>
>;
type _RequestOptionsMatchNativeContract = Expect<
  Equal<LocationRequestOptions, NativeLocationRequestOptions>
>;
type _SettingsOptionsMatchNativeContract = Expect<
  Equal<LocationSettingsOptions, NativeLocationSettingsOptions>
>;
type _LastKnownPositionOptionsAreCacheSpecific = Expect<
  Equal<
    keyof LastKnownPositionOptions,
    | "maximumAge"
    | "accuracy"
    | "granularity"
    | "waitForAccurateLocation"
    | "maxUpdateAge"
  >
>;
type _CurrentPositionOptionsExcludeWatchLimit = Expect<
  Equal<Extract<"maxUpdates", keyof CurrentPositionOptions>, never>
>;
type _HookResultIsNamed = Expect<
  Equal<UseWatchPositionResult["error"], LocationError | null>
>;
type _BackgroundDiagnosisIsNamed = Expect<
  Equal<BackgroundLocationDiagnosis["healthy"], boolean>
>;
type _BackgroundProviderIsPublic = Expect<
  Equal<AndroidBackgroundProvider, "auto" | "playServices" | "android">
>;
type _BackgroundGeofenceEventHasPublicName = Expect<
  Equal<BackgroundGeofenceEvent, NativeBackgroundGeofenceEvent>
>;
type _BackgroundActivityEventHasPublicName = Expect<
  Equal<BackgroundActivityEvent, NativeBackgroundActivityEvent>
>;
type _StartActivityOptionsAreActionSpecific = Expect<
  Equal<
    StartActivityRecognitionOptions,
    {
      interval?: number;
      stopOnStill?: boolean;
      minimumConfidence?: number;
    }
  >
>;
type _RootConfigurationMatchesNativeContract = Expect<
  Equal<
    Simplify<
      Omit<GeolocationConfiguration, "locationProvider"> & {
        locationProvider?: NativeLocationProvider;
      }
    >,
    NativeGeolocationConfiguration
  >
>;
type _CompatConfigurationMatchesNativeContract = Expect<
  Equal<
    Simplify<
      Omit<CompatGeolocationConfiguration, "locationProvider"> & {
        locationProvider?: LocationProviderInternal;
      }
    >,
    CompatGeolocationConfigurationInternal
  >
>;

const timeoutCode: LocationErrorCodeType = LocationErrorCodes.TIMEOUT;
type _LocationErrorCodesMatchType = Expect<
  Equal<
    (typeof LocationErrorCodes)[keyof typeof LocationErrorCodes],
    LocationErrorCodeType
  >
>;
void timeoutCode;

declare const nativeRoot: typeof import("../src/index");
declare const webRoot: typeof import("../src/index.web");
const nativeRootFromWeb: typeof nativeRoot = webRoot;
const webRootFromNative: typeof webRoot = nativeRoot;
void nativeRootFromWeb;
void webRootFromNative;

declare const nativeCompat: typeof import("../src/compat/index");
declare const webCompat: typeof import("../src/compat/index.web");
const nativeCompatFromWeb: typeof nativeCompat = webCompat;
const webCompatFromNative: typeof webCompat = nativeCompat;
void nativeCompatFromWeb;
void webCompatFromNative;

declare const nativeBackground: typeof import("../src/background/index");
declare const webBackground: typeof import("../src/background/index.web");
const nativeBackgroundFromWeb: typeof nativeBackground = webBackground;
const webBackgroundFromNative: typeof webBackground = nativeBackground;
void nativeBackgroundFromWeb;
void webBackgroundFromNative;
