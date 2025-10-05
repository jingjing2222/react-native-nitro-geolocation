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

export { setRNConfiguration } from "./setRNConfiguration";
export { getCurrentPosition } from "./getCurrentPosition";
export { requestAuthorization } from "./requestAuthorization";

import { getCurrentPosition } from "./getCurrentPosition";
import { requestAuthorization } from "./requestAuthorization";
import { setRNConfiguration } from "./setRNConfiguration";

const Geolocation = {
  setRNConfiguration,
  requestAuthorization,
  getCurrentPosition
};

export default Geolocation;
