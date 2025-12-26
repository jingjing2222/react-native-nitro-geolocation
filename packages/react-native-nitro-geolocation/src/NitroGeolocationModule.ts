import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocationCompat } from "./NitroGeolocationCompat.nitro";

export const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocationCompat>(
    "NitroGeolocationCompat"
  );
