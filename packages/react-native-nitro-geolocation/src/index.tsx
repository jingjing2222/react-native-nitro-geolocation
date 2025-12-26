// TODO: Implement new API
// For legacy API, use: import Geolocation from 'react-native-nitro-geolocation/compat'

import { helloWorld } from "./helloworld";

// Export types for now
export type {
  GeolocationConfiguration,
  GeolocationResponse,
  GeolocationError,
  GeolocationOptions
} from "./types";

export const Geolocation = {
  helloWorld
};
