import type { LocationReadiness } from "react-native-nitro-geolocation";

export function expectReadyWithCache(readiness: LocationReadiness) {
  if (!readiness.ready || !readiness.cache.available) {
    throw new Error(
      `Expected ready browser diagnosis with cache, got ${JSON.stringify(readiness)}.`
    );
  }
  if (readiness.remediations.length > 0) {
    throw new Error(
      `Ready browser diagnosis returned remediations: ${readiness.remediations.join(",")}.`
    );
  }
}
