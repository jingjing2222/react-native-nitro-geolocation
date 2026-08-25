import { LocationErrorCode } from "../src";
import type {
  LocationError,
  LocationErrorCode as LocationErrorCodeType,
  UseWatchPositionResult
} from "../src";
import type {
  AndroidBackgroundProvider,
  BackgroundLocationDiagnosis
} from "../src/background";

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
  Value
>() => Value extends Right ? 1 : 2
  ? true
  : false;
type Expect<Value extends true> = Value;

type _LocationErrorUsesPublicCode = Expect<
  Equal<LocationError["code"], LocationErrorCodeType>
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
type _HookResultIsNamed = Expect<
  Equal<UseWatchPositionResult["error"], LocationError | null>
>;
type _BackgroundDiagnosisIsNamed = Expect<
  Equal<BackgroundLocationDiagnosis["healthy"], boolean>
>;
type _BackgroundProviderIsPublic = Expect<
  Equal<AndroidBackgroundProvider, "auto" | "playServices" | "android">
>;

const timeoutCode: LocationErrorCodeType = LocationErrorCode.TIMEOUT;
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
