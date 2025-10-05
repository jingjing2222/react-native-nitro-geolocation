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
export { setRNConfiguration } from "./setRNConfiguration";
export { requestAuthorization } from "./requestAuthorization";
export { getCurrentPosition } from "./getCurrentPosition";

// Default export for compatibility
import { requestAuthorization } from "./requestAuthorization";
import { setRNConfiguration } from "./setRNConfiguration";
import { getCurrentPosition } from "./getCurrentPosition";

const Geolocation = {
  setRNConfiguration,
  requestAuthorization,
  getCurrentPosition
};

export default Geolocation;
