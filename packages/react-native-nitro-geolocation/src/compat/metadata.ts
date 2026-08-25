import type {
  CompatGeolocationOptions,
  CompatGeolocationResponse,
  CompatGeolocationResponseWithMetadata
} from "../publicTypes";
import type {
  CompatGeolocationResponseWithMetadataInternal,
  CompatGeolocationOptions as NativeCompatGeolocationOptions
} from "../types";

type CompatPosition = Pick<
  CompatGeolocationResponseWithMetadataInternal,
  "coords" | "timestamp"
>;

export function toCompatResponse(
  position: CompatPosition
): CompatGeolocationResponse {
  return {
    coords: position.coords,
    timestamp: position.timestamp
  };
}

export function toCompatResponseWithMetadata(
  position: CompatGeolocationResponseWithMetadataInternal
): CompatGeolocationResponseWithMetadata {
  const response: CompatGeolocationResponseWithMetadata = {
    coords: position.coords,
    timestamp: position.timestamp
  };

  if (typeof position.mocked === "boolean") {
    response.mocked = position.mocked;
  }

  response.provider = position.provider;

  return response;
}

export function toNativeCompatOptions(
  options?: CompatGeolocationOptions
): NativeCompatGeolocationOptions {
  if (!options) {
    return {};
  }

  const { includeExtraMetadata: _includeExtraMetadata, ...nativeOptions } =
    options;
  return nativeOptions;
}
