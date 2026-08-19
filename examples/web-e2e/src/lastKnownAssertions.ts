import type { GeolocationResponse } from "react-native-nitro-geolocation";

export function expectCacheMiss(
  cached: GeolocationResponse | undefined,
  message: string
): void {
  if (cached !== undefined) {
    throw new Error(message);
  }
}

export function expectCachedPosition(
  cached: GeolocationResponse | undefined,
  message: string
): GeolocationResponse {
  if (!cached) {
    throw new Error(message);
  }
  return cached;
}

export function expectLatestCachedPosition(
  cached: GeolocationResponse | undefined,
  expectedTimestamp: number,
  validate: (position: GeolocationResponse) => void
): void {
  const position = expectCachedPosition(
    cached,
    "Sync module cache did not return a position."
  );
  validate(position);
  if (position.timestamp !== expectedTimestamp) {
    throw new Error("Sync module cache did not return the latest position.");
  }
}

export function expectValidCachedPosition(
  cached: GeolocationResponse | undefined,
  message: string,
  validate: (position: GeolocationResponse) => void
): void {
  validate(expectCachedPosition(cached, message));
}
