import {
  getLastKnownPosition,
  getLastKnownPositionAsync
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";

const moduleCache: GeolocationResponse | undefined = getLastKnownPosition();
const platformCache: Promise<GeolocationResponse | undefined> =
  getLastKnownPositionAsync({ maximumAge: 30_000 });

// @ts-expect-error v2 sync cache reads do not query native sources or accept filters.
getLastKnownPosition({ maximumAge: 30_000 });

void [moduleCache, platformCache];
