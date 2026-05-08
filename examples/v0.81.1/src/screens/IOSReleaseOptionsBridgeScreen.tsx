import React, { useEffect, useRef, useState } from "react";
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
import {
  PermissionStatusBlock,
  ResultBlock,
  SEOUL_FIXTURE,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  captureLocationError,
  createScenarioResult,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "ios-release-options-bridge";
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

const initialResults = createScenarioResults([
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

export default function IOSReleaseOptionsBridgeScreen() {
  const { permissionStatus, refreshPermission, ensurePermission } =
    usePermissionStatus();
  const [updateCount, setUpdateCount] = useState(0);
  const { results, setResult } = useScenarioResults(initialResults);
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

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="iOS Release Options Bridge"
      subtitle="Native Swift optional struct bridge contract"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Distance Filter Guard"
        description="Release bridge regression check for caller options on watchPosition."
        divided
      >
        <StatusBlock
          rows={[
            {
              label: "Updates:",
              value: updateCount,
              testID: `${PREFIX}-update-count`
            }
          ]}
        />
        <ScenarioButton
          title="Run Distance Filter Guard"
          onPress={runDistanceFilterGuard}
          testID={`${PREFIX}-run-distance-filter-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="distance-filter"
          label="Distance filter guard"
          result={results.distanceFilter}
        />
      </ScenarioSection>

      <ScenarioSection
        index={3}
        title="Maximum Age Option Guard"
        description="Release bridge regression check that maximumAge=0 filters cached locations in native Swift."
        divided
      >
        <ScenarioButton
          title="Run Maximum Age Option Guard"
          onPress={runMaximumAgeZeroGuard}
          testID={`${PREFIX}-run-maximum-age-zero-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="maximum-age-zero"
          label="Maximum age option guard"
          result={results.maximumAgeZero}
        />
      </ScenarioSection>

      <ScenarioSection
        index={4}
        title="Heading Filter Option Guard"
        description="Release bridge regression check that headingFilter=-1 reaches native Swift validation."
        divided
      >
        <ScenarioButton
          title="Run Heading Filter Option Guard"
          onPress={runHeadingFilterGuard}
          testID={`${PREFIX}-run-heading-filter-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="heading-filter"
          label="Heading filter option guard"
          result={results.headingFilter}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
