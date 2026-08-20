import type { GeolocationResponse } from "react-native-nitro-geolocation";

export type ExpectedLocation = {
  latitude: number;
  longitude: number;
};

export const expectedLocations = {
  getCurrentPosition: { latitude: 37.5671, longitude: 126.9786 },
  watchPosition: { latitude: 37.5678, longitude: 126.9793 },
  unwatchInitial: { latitude: 37.5685, longitude: 126.98 },
  unwatchAfterClear: { latitude: 37.5692, longitude: 126.9807 },
  stopObservingInitial: { latitude: 37.5699, longitude: 126.9814 },
  stopObservingAfterClear: { latitude: 37.5706, longitude: 126.9821 },
  compatGetCurrentPosition: { latitude: 37.5713, longitude: 126.9828 },
  compatWatchPositionInitial: { latitude: 37.572, longitude: 126.9835 },
  compatWatchPositionAfterClear: { latitude: 37.5727, longitude: 126.9842 },
  compatStopObservingInitial: { latitude: 37.5734, longitude: 126.9849 },
  compatStopObservingAfterClear: { latitude: 37.5741, longitude: 126.9856 }
} as const;

const expectedLocationTolerance = 0.00015;

export function assertPosition(position: GeolocationResponse) {
  if (
    typeof position.coords.latitude !== "number" ||
    typeof position.coords.longitude !== "number" ||
    typeof position.coords.accuracy !== "number" ||
    typeof position.timestamp !== "number"
  ) {
    throw new Error("Position missing numeric coords/timestamp.");
  }
}

export function assertLocationMetadata(
  position: GeolocationResponse,
  expectedSource:
    | "currentPosition"
    | "watchPosition"
    | "platformCache"
    | "moduleCache"
) {
  const metadata = position.metadata;
  if (!metadata) {
    throw new Error("Modern position missing location metadata.");
  }
  if (metadata.source !== expectedSource) {
    throw new Error(
      `Expected metadata source ${expectedSource}, got ${metadata.source}.`
    );
  }
  if (
    metadata.age === undefined ||
    !Number.isFinite(metadata.age) ||
    metadata.age < 0
  ) {
    throw new Error(`Modern position has invalid age: ${metadata.age}.`);
  }
  if (
    !(["high", "medium", "low", "unknown"] as const).includes(metadata.quality)
  ) {
    throw new Error(
      `Modern position has invalid quality: ${metadata.quality}.`
    );
  }
}

export function assertModernPosition(
  position: GeolocationResponse,
  source: NonNullable<GeolocationResponse["metadata"]>["source"]
) {
  assertPosition(position);
  assertLocationMetadata(position, source);
}

export function getErrorCode(error: unknown): unknown {
  return (error as { code?: unknown }).code;
}

export function isNearExpected(
  position: GeolocationResponse,
  expected: ExpectedLocation
) {
  return (
    Math.abs(position.coords.latitude - expected.latitude) <=
      expectedLocationTolerance &&
    Math.abs(position.coords.longitude - expected.longitude) <=
      expectedLocationTolerance
  );
}
