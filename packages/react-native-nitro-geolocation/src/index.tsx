import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocation } from "./NitroGeolocation.nitro";
import type { RNConfiguration } from "./NitroGeolocation.nitro";

const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocation>("NitroGeolocation");

export function setRNConfiguration(config: RNConfiguration): void {
  NitroGeolocationHybridObject.setRNConfiguration(config);
}

export type { RNConfiguration } from "./NitroGeolocation.nitro";

// Default export for compatibility
const Geolocation = {
  setRNConfiguration
};

export default Geolocation;
