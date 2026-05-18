import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLastKnownPosition,
  unwatch,
  watchHeading,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationError,
  LocationRequestOptions
} from "react-native-nitro-geolocation";
import { usePermissionStatus } from "../hooks/usePermissionStatus";
import { useScenarioResults } from "../hooks/useScenarioResults";
import { SEOUL_FIXTURE } from "../utils/locationAssertions";
import {
  captureLocationError,
  getDisplayErrorMessage
} from "../utils/locationErrors";
import { runWithNativeGeolocation } from "../utils/nativeGeolocation";
import { createScenarioResult, createScenarioResults } from "../utils/results";

const DISTANCE_FILTER_METERS = 1_000_000;
const SECOND_UPDATE_WINDOW_MS = 5000;
const HEADING_FILTER_WATCHDOG_MS = 2000;
const EXPECTED_BASELINE_TOLERANCE_METERS = 100;
const NEARBY_MOVE_MIN_METERS = 5;
const NEARBY_MOVE_MAX_METERS = 1000;

const guardedWatchOptions: LocationRequestOptions = {
  distanceFilter: DISTANCE_FILTER_METERS,
  enableHighAccuracy: true,
  maximumAge: 0
};

export const iosReleaseOptionsBridgeResults = createScenarioResults([
  "distanceFilter",
  "maximumAgeZero",
  "headingFilter"
] as const);

const formatCoordinates = (position: GeolocationResponse) =>
  `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(
    6
  )}`;

const distanceInMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const getFixtureDistance = (position: GeolocationResponse) =>
  distanceInMeters(position.coords, SEOUL_FIXTURE);

export const useIOSReleaseOptionsBridgeScenario = () => {
  const { permissionStatus, refreshPermission, ensurePermission } =
    usePermissionStatus();
  const [updateCount, setUpdateCount] = useState(0);
  const { results, setResult } = useScenarioResults(
    iosReleaseOptionsBridgeResults
  );
  const watchTokenRef = useRef<string | null>(null);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCountRef = useRef(0);
  const baselineRef = useRef<GeolocationResponse | null>(null);

  const cleanupWatch = () => {
    if (guardTimerRef.current) {
      clearTimeout(guardTimerRef.current);
      guardTimerRef.current = null;
    }

    if (watchTokenRef.current) {
      unwatch(watchTokenRef.current);
      watchTokenRef.current = null;
    }
  };

  const failWithError = (error: unknown) => {
    cleanupWatch();
    setResult(
      "distanceFilter",
      createScenarioResult("failed", getDisplayErrorMessage(error))
    );
  };

  const handleWatchUpdate = (position: GeolocationResponse) => {
    updateCountRef.current += 1;
    const nextCount = updateCountRef.current;
    setUpdateCount(nextCount);

    const coordinates = formatCoordinates(position);
    const fixtureDistance = getFixtureDistance(position);
    const baseline = baselineRef.current;
    if (!baseline) {
      if (fixtureDistance > EXPECTED_BASELINE_TOLERANCE_METERS) {
        setResult(
          "distanceFilter",
          createScenarioResult(
            "running",
            `Waiting for simulator fixture, received ${coordinates} (${Math.round(
              fixtureDistance
            )}m away).`
          )
        );
        return;
      }

      baselineRef.current = position;
      setResult(
        "distanceFilter",
        createScenarioResult(
          "running",
          `First fixture update captured at ${coordinates}; waiting ${SECOND_UPDATE_WINDOW_MS}ms for distanceFilter=${DISTANCE_FILTER_METERS}m to suppress nearby movement.`
        )
      );

      guardTimerRef.current = setTimeout(() => {
        cleanupWatch();
        setResult(
          "distanceFilter",
          createScenarioResult(
            "passed",
            `distanceFilter=${DISTANCE_FILTER_METERS}m did not emit a nearby movement update.`
          )
        );
      }, SECOND_UPDATE_WINDOW_MS);
      return;
    }

    const movedMeters = distanceInMeters(baseline.coords, position.coords);
    if (movedMeters < NEARBY_MOVE_MIN_METERS) {
      setResult(
        "distanceFilter",
        createScenarioResult(
          "running",
          `Ignoring duplicate fixture update at ${coordinates}; waiting for distanceFilter=${DISTANCE_FILTER_METERS}m to suppress nearby movement.`
        )
      );
      return;
    }

    if (movedMeters > NEARBY_MOVE_MAX_METERS) {
      setResult(
        "distanceFilter",
        createScenarioResult(
          "running",
          `Ignoring far simulator reset at ${coordinates} (${Math.round(
            movedMeters
          )}m from baseline).`
        )
      );
      return;
    }

    cleanupWatch();
    setResult(
      "distanceFilter",
      createScenarioResult(
        "failed",
        `Unexpected nearby update #${nextCount} at ${coordinates} (${Math.round(
          movedMeters
        )}m from baseline); distanceFilter=${DISTANCE_FILTER_METERS}m was not honored.`
      )
    );
  };

  const runDistanceFilterGuard = async () => {
    cleanupWatch();
    updateCountRef.current = 0;
    baselineRef.current = null;
    setUpdateCount(0);
    setResult(
      "distanceFilter",
      createScenarioResult(
        "running",
        "Starting iOS Release distanceFilter guard"
      )
    );

    try {
      if (Platform.OS !== "ios") {
        throw new Error("This contract is iOS-only.");
      }

      await ensurePermission();

      watchTokenRef.current = await runWithNativeGeolocation(() =>
        Promise.resolve(
          watchPosition(
            handleWatchUpdate,
            (error: LocationError) => {
              failWithError(error);
            },
            guardedWatchOptions
          )
        )
      );
    } catch (error) {
      failWithError(error);
    }
  };

  const runMaximumAgeZeroGuard = async () => {
    setResult(
      "maximumAgeZero",
      createScenarioResult(
        "running",
        "Seeding native cache, then reading with maximumAge=0"
      )
    );

    try {
      if (Platform.OS !== "ios") {
        throw new Error("This contract is iOS-only.");
      }

      await ensurePermission();

      await runWithNativeGeolocation(() =>
        getCurrentPosition({
          ...guardedWatchOptions,
          timeout: 15000
        })
      );

      try {
        await runWithNativeGeolocation(() =>
          getLastKnownPosition({ maximumAge: 0 })
        );
        setResult(
          "maximumAgeZero",
          createScenarioResult(
            "failed",
            "maximumAge=0 unexpectedly resolved cached data; caller options were dropped before reaching Swift."
          )
        );
      } catch (error) {
        const locationError = captureLocationError(error);
        setResult(
          "maximumAgeZero",
          createScenarioResult(
            locationError.code === LocationErrorCode.POSITION_UNAVAILABLE
              ? "passed"
              : "failed",
            `${locationError.name}: ${locationError.message}`
          )
        );
      }
    } catch (error) {
      setResult(
        "maximumAgeZero",
        createScenarioResult("failed", getDisplayErrorMessage(error))
      );
    } finally {
      await refreshPermission();
    }
  };

  const runHeadingFilterGuard = async () => {
    setResult(
      "headingFilter",
      createScenarioResult(
        "running",
        "Starting heading watch with headingFilter=-1"
      )
    );

    try {
      if (Platform.OS !== "ios") {
        throw new Error("This contract is iOS-only.");
      }

      await ensurePermission();

      const outcome = await runWithNativeGeolocation(
        () =>
          new Promise<
            | { type: "rejected"; error: unknown }
            | { type: "resolved" }
            | { type: "watchdog" }
          >((resolve) => {
            let token: string | null = null;
            let didFinish = false;

            const finish = (
              result:
                | { type: "rejected"; error: unknown }
                | { type: "resolved" }
                | { type: "watchdog" }
            ) => {
              if (didFinish) {
                return;
              }
              didFinish = true;
              if (token) {
                unwatch(token);
              }
              resolve(result);
            };

            token = watchHeading(
              () => finish({ type: "resolved" }),
              (error) => finish({ type: "rejected", error }),
              { headingFilter: -1 }
            );

            setTimeout(
              () => finish({ type: "watchdog" }),
              HEADING_FILTER_WATCHDOG_MS
            );
          })
      );

      if (outcome.type === "watchdog") {
        setResult(
          "headingFilter",
          createScenarioResult(
            "failed",
            `headingFilter=-1 did not reject within ${HEADING_FILTER_WATCHDOG_MS}ms; caller options were dropped before reaching Swift.`
          )
        );
        return;
      }

      if (outcome.type === "resolved") {
        setResult(
          "headingFilter",
          createScenarioResult(
            "failed",
            "headingFilter=-1 unexpectedly emitted a heading; caller options were dropped before reaching Swift."
          )
        );
        return;
      }

      const locationError = captureLocationError(outcome.error);
      setResult(
        "headingFilter",
        createScenarioResult(
          locationError.code === LocationErrorCode.INTERNAL_ERROR &&
            locationError.message.includes("headingFilter")
            ? "passed"
            : "failed",
          `${locationError.name}: ${locationError.message}`
        )
      );
    } catch (error) {
      setResult(
        "headingFilter",
        createScenarioResult("failed", getDisplayErrorMessage(error))
      );
    } finally {
      await refreshPermission();
    }
  };

  useEffect(() => cleanupWatch, []);

  return {
    permissionStatus,
    results,
    updateCount,
    runDistanceFilterGuard,
    runMaximumAgeZeroGuard,
    runHeadingFilterGuard
  };
};
