export let useGeolocationDevTools: typeof import(
  "./src/react-native/useGeolocationDevTools"
).useGeolocationDevTools;

declare const __DEV__: boolean;

export {
  LOCATION_PRESETS,
  createPosition,
  type LocationPreset,
  type LocationPresetName
} from "./src/shared/presets";

export type { Position, GeolocationCoordinates } from "./src/shared/types";

const isReactNativeDev = typeof __DEV__ !== "undefined" && __DEV__ === true;
const isWeb =
  typeof window !== "undefined" && window.navigator.product !== "ReactNative";
const isServer = typeof window === "undefined";

if (isReactNativeDev && !isWeb && !isServer) {
  useGeolocationDevTools =
    require("./src/react-native/useGeolocationDevTools").useGeolocationDevTools;
} else {
  useGeolocationDevTools = () => {};
}
