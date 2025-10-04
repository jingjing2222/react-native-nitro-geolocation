import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocation } from "./NitroGeolocation.nitro";

const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocation>("NitroGeolocation");

export function addition(a: number, b: number): number {
  return NitroGeolocationHybridObject.addition(a, b);
}

export function subtraction(a: number, b: number): number {
  return NitroGeolocationHybridObject.subtraction(a, b);
}

export function multiply(a: number, b: number): number {
  return NitroGeolocationHybridObject.multiply(a, b);
}

export function division(a: number, b: number): number {
  return NitroGeolocationHybridObject.division(a, b);
}

export function test(a: number, b: number): number {
  return NitroGeolocationHybridObject.test(a, b);
}
