import type { HybridObject } from "react-native-nitro-modules";

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  helloWorld(): Promise<string>;
}
