import type { LocationReadiness } from "react-native-nitro-geolocation";

export function expectReadyOrRequestableWithCache(
  readiness: LocationReadiness
) {
  if (!readiness.cache.available) {
    throw new Error(
      `Expected browser diagnosis with observed cache, got ${JSON.stringify(readiness)}.`
    );
  }

  const isReady =
    readiness.ready &&
    readiness.permission === "granted" &&
    readiness.remediations.length === 0;
  const needsPermissionIntrospection =
    !readiness.ready &&
    readiness.permission === "undetermined" &&
    readiness.remediations.length === 1 &&
    readiness.remediations[0] === "requestPermission";

  if (!isReady && !needsPermissionIntrospection) {
    throw new Error(
      `Expected ready or conservatively requestable browser diagnosis, got ${JSON.stringify(readiness)}.`
    );
  }
}
