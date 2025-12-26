import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocationCompat } from "./NitroGeolocationCompat.nitro";
import type { NitroGeolocation } from "./NitroGeolocation.nitro";

export const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocation>(
    "NitroGeolocation"
  );

export const NitroGeolocationHybridCompatObject =
  NitroModules.createHybridObject<NitroGeolocationCompat>(
    "NitroGeolocationCompat"
  );
