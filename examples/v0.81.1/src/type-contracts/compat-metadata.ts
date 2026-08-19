import Geolocation from "react-native-nitro-geolocation/compat";
import type {
  GeolocationOptions,
  GeolocationOptionsWithMetadata,
  GeolocationResponse,
  GeolocationResponseWithMetadata,
  LocationProviderUsed
} from "react-native-nitro-geolocation/compat";

Geolocation.getCurrentPosition((position) => {
  const exactResponse: GeolocationResponse = position;
  // @ts-expect-error default compat responses preserve the community shape.
  position.mocked;
  // @ts-expect-error default compat responses preserve the community shape.
  position.provider;
  void exactResponse;
});

const metadataOptions: GeolocationOptionsWithMetadata = {
  includeExtraMetadata: true,
  enableHighAccuracy: true
};

Geolocation.getCurrentPosition(
  (position) => {
    const metadataResponse: GeolocationResponseWithMetadata = position;
    const mocked: boolean | undefined = position.mocked;
    const provider: LocationProviderUsed | undefined = position.provider;
    void [metadataResponse, mocked, provider];
  },
  undefined,
  metadataOptions
);

const runtimeFlag: boolean = Date.now() > 0;
const runtimeOptions: GeolocationOptions = {
  includeExtraMetadata: runtimeFlag
};

Geolocation.watchPosition(
  (position) => {
    // A broad boolean cannot promise the opt-in response type.
    // @ts-expect-error only literal true selects the metadata overload.
    position.mocked;
  },
  undefined,
  runtimeOptions
);
