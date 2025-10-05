// Export types
export type {
  AuthorizationLevel,
  LocationProvider,
  RNConfiguration,
  GeolocationCoordinates,
  GeolocationPosition,
  GeolocationError,
  GeolocationOptions
} from "./types";

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

export default Geolocation;
