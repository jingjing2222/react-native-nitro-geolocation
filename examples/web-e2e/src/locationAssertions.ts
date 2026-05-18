import type {
  GeolocationResponse,
  LocationError
} from "react-native-nitro-geolocation";

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
  stopObservingAfterClear: { latitude: 37.5706, longitude: 126.9821 }
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

export function getErrorCode(error: unknown): number | undefined {
  return (error as Partial<LocationError>).code;
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
