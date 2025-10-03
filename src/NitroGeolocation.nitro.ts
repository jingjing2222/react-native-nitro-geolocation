import type { HybridObject } from "react-native-nitro-modules";

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  addition(a: number, b: number): number;
  subtraction(a: number, b: number): number;
  multiply(a: number, b: number): number;
  division(a: number, b: number): number;
}
