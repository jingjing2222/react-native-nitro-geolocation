// Export methods
export { clearWatch } from "./clearWatch";
export { getCurrentPosition } from "./getCurrentPosition";
export { requestAuthorization } from "./requestAuthorization";
export { setRNConfiguration } from "./setRNConfiguration";
export { stopObserving } from "./stopObserving";
export { watchPosition } from "./watchPosition";

// Default export for compatibility
import { clearWatch } from "./clearWatch";
import { getCurrentPosition } from "./getCurrentPosition";
import { requestAuthorization } from "./requestAuthorization";
import { setRNConfiguration } from "./setRNConfiguration";
import { stopObserving } from "./stopObserving";
import { watchPosition } from "./watchPosition";

const Geolocation = {
  setRNConfiguration,
  requestAuthorization,
  getCurrentPosition,
  watchPosition,
  clearWatch,
  stopObserving
};

// Export types
export type {
  CompatGeolocationConfiguration as GeolocationConfiguration,
  CompatGeolocationResponse as GeolocationResponse,
  CompatGeolocationError as GeolocationError,
  CompatGeolocationOptions as GeolocationOptions
} from "../publicTypes";

export default Geolocation;
