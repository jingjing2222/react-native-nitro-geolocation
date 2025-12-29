export let useGeolocationDevTools: typeof import(
  "./src/react-native/useGeolocationDevTools"
).useGeolocationDevTools;

export {
  LOCATION_PRESETS,
  createPosition,
  type LocationPreset,
  type LocationPresetName
} from "./src/shared/presets";

const isWeb =
  typeof window !== "undefined" && window.navigator.product !== "ReactNative";
const isDev = process.env.NODE_ENV !== "production";
const isServer = typeof window === "undefined";

if (isDev && !isWeb && !isServer) {
  useGeolocationDevTools =
    require("./src/react-native/useGeolocationDevTools").useGeolocationDevTools;
} else {
  useGeolocationDevTools = () => {};
}
