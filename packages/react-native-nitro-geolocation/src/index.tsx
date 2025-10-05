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

// Default export for compatibility
import { requestAuthorization } from "./requestAuthorization";
import { setRNConfiguration } from "./setRNConfiguration";

const Geolocation = {
  setRNConfiguration,
  requestAuthorization
};

export default Geolocation;
