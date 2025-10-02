import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocation } from "./NitroGeolocation.nitro";

const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocation>("NitroGeolocation");

export function multiply(a: number, b: number): number {
  return NitroGeolocationHybridObject.multiply(a, b);
}
