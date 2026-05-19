import { Platform } from "react-native";
import {
  getCurrentPosition,
  setConfiguration
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationProviderStatus
} from "react-native-nitro-geolocation";
import {
  SEOUL_FIXTURE,
  assertFixtureCoordinates
} from "../utils/locationAssertions";
import { runWithNativeGeolocation } from "../utils/nativeGeolocation";

const ANDROID_COARSE_COORDINATE_TOLERANCE = 0.03;
const EXACT_FIXTURE_COORDINATE_TOLERANCE = 0.000001;
const PROVIDER_SELECTION_FRESHNESS_GRACE_MS = 30000;
const SECOND_UPDATE_FIXTURE = {
  latitude: 37.5765,
  longitude: 126.988
};
const SECOND_UPDATE_COORDINATE_TOLERANCE = 0.003;

export const WATCH_TIMEOUT_MS = 30000;
export const WATCH_FRESHNESS_GRACE_MS = 10000;
export const WATCH_SECOND_UPDATE_QUIET_WINDOW_MS = 10000;
export const LIVE_PROVIDER_SELECTION_TIMEOUT_MS = 30000;
export const REQUEST_OPTIONS_TIMEOUT_MS = 15000;

export const assertFinitePosition = (position: GeolocationResponse) => {
  if (
    !Number.isFinite(position.coords.latitude) ||
    !Number.isFinite(position.coords.longitude)
  ) {
    throw new Error("Position contained non-finite coordinates.");
  }
};

export const assertFreshPosition = (
  position: GeolocationResponse,
  startedAt: number,
  label: string,
  graceMs = WATCH_FRESHNESS_GRACE_MS
) => {
  if (position.timestamp < startedAt - graceMs) {
    throw new Error(
      `${label} returned stale timestamp ${position.timestamp}; startedAt=${startedAt}.`
    );
  }
};

export const assertRealDevicePosition = (
  position: GeolocationResponse,
  startedAt?: number,
  label = "Provider selection"
) => {
  assertFinitePosition(position);

  if (Platform.OS === "android" && position.mocked !== false) {
    throw new Error(
      `Provider selection did not prove a real Android position; mocked=${position.mocked ?? "unknown"}.`
    );
  }

  if (startedAt !== undefined) {
    assertFreshPosition(
      position,
      startedAt,
      label,
      PROVIDER_SELECTION_FRESHNESS_GRACE_MS
    );
  }

  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
};

export const assertAndroidCoarseFixtureCoordinates = (
  position: GeolocationResponse
) => {
  return assertFixtureCoordinates(position, {
    coordinateTolerance: ANDROID_COARSE_COORDINATE_TOLERANCE
  });
};

export const assertErrorMessageIncludes = (
  error: unknown,
  expectedMessage: string,
  label: string
) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  if (!message.includes(expectedMessage)) {
    throw new Error(
      `${label} returned unexpected native error message: ${message}`
    );
  }
};

export const assertSecondUpdateCoordinates = (
  position: GeolocationResponse,
  label: string
) => {
  assertFinitePosition(position);

  const latitudeDelta = Math.abs(
    position.coords.latitude - SECOND_UPDATE_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SECOND_UPDATE_FIXTURE.longitude
  );

  if (
    latitudeDelta > SECOND_UPDATE_COORDINATE_TOLERANCE ||
    longitudeDelta > SECOND_UPDATE_COORDINATE_TOLERANCE
  ) {
    throw new Error(
      `${label} second-location probe did not match injected update: ${position.coords.latitude.toFixed(
        6
      )}, ${position.coords.longitude.toFixed(6)}.`
    );
  }

  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
};

export const requestSecondUpdateProbe = async (label: string) => {
  const position = await getCurrentPosition({
    accuracy: {
      android: "high"
    },
    granularity: "fine",
    maximumAge: 0,
    maxUpdateAge: 0,
    maxUpdateDelay: 0,
    timeout: 7000
  });

  if (Platform.OS === "android" && position.mocked !== true) {
    throw new Error(
      `${label} second-location probe was not mocked; mocked=${position.mocked ?? "unknown"}.`
    );
  }

  return assertSecondUpdateCoordinates(position, label);
};

export const assertNotExactFixtureCoordinates = (
  position: GeolocationResponse,
  label: string
) => {
  const latitudeDelta = Math.abs(
    position.coords.latitude - SEOUL_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SEOUL_FIXTURE.longitude
  );

  if (
    latitudeDelta <= EXACT_FIXTURE_COORDINATE_TOLERANCE &&
    longitudeDelta <= EXACT_FIXTURE_COORDINATE_TOLERANCE
  ) {
    throw new Error(`${label} returned the exact seeded fine fixture.`);
  }
};

export const configurePlayServices = () => {
  setConfiguration({
    locationProvider: Platform.OS === "android" ? "playServices" : "auto"
  });
};

export const configureAutoProvider = () => {
  setConfiguration({
    locationProvider: "auto"
  });
};

export const configurePlatformProvider = () => {
  setConfiguration({
    locationProvider: Platform.OS === "android" ? "android" : "auto"
  });
};

export const configureNativePlatformProvider = () => {
  setConfiguration({
    locationProvider:
      Platform.OS === "android" ? ("android_platform" as "android") : "auto"
  });
};

export const isAndroidPlatformProvider = (provider?: string) => {
  return provider === "gps" || provider === "network" || provider === "passive";
};

const hasGoogleLocationAccuracyStatus = (status: LocationProviderStatus) => {
  return (
    Platform.OS === "android" &&
    status.googleLocationAccuracyEnabled !== undefined
  );
};

export const assertPreferredProvider = (
  position: GeolocationResponse,
  status: LocationProviderStatus,
  label: "auto" | "playServices"
) => {
  if (Platform.OS !== "android") {
    return `${label} returned native provider`;
  }

  if (
    position.provider !== "fused" &&
    !isAndroidPlatformProvider(position.provider)
  ) {
    throw new Error(
      `Expected ${label} to return fused or platform fallback provider, received ${position.provider ?? "unknown"}.`
    );
  }

  if (position.provider === "fused") {
    return hasGoogleLocationAccuracyStatus(status)
      ? `${label} returned fused provider with Google location accuracy status`
      : `${label} returned fused provider without Google location accuracy status`;
  }

  throw new Error(
    `Expected live ${label} provider-selection proof to return fused, received ${position.provider ?? "unknown"}.`
  );
};

export const assertFreshWatchReading = (
  position: GeolocationResponse,
  startedAt: number,
  label: string
) => {
  assertFreshPosition(position, startedAt, `${label} watcher`);
};

export const requestSeededCoarsePosition = async (
  label: "auto" | "playServices"
) => {
  const position = await runWithNativeGeolocation(() =>
    getCurrentPosition({
      accuracy: {
        android: "high",
        ios: "best"
      },
      granularity: "coarse",
      waitForAccurateLocation: true,
      maxUpdateAge: 0,
      maxUpdateDelay: 0,
      maximumAge: 0,
      timeout: REQUEST_OPTIONS_TIMEOUT_MS
    })
  );
  const coordinates = assertAndroidCoarseFixtureCoordinates(position);
  return `${label} coarse request returned ${coordinates}`;
};
