import type {
  GeolocationResponse,
  LocationProviderUsed
} from "react-native-nitro-geolocation";
import type { GeolocationResponse as CompatGeolocationResponse } from "react-native-nitro-geolocation/compat";

const coords = {
  latitude: 37.5665,
  longitude: 126.978,
  altitude: null,
  accuracy: 5,
  altitudeAccuracy: null,
  heading: null,
  speed: null
};

const modernPosition: GeolocationResponse = {
  coords,
  timestamp: 1779015190000,
  mocked: true,
  provider: "gps"
};

const providers: LocationProviderUsed[] = [
  "fused",
  "gps",
  "network",
  "passive",
  "unknown"
];

const compatPosition: CompatGeolocationResponse = {
  coords,
  timestamp: modernPosition.timestamp
};

// @ts-expect-error Compat keeps the community response shape.
void compatPosition.mocked;
// @ts-expect-error Compat keeps the community response shape.
void compatPosition.provider;

// @ts-expect-error Modern providers are a closed native-provider union.
providers.push("bluetooth");

void [modernPosition, providers, compatPosition];
