import React, { useEffect, useRef, useState } from "react";
import { Button, Platform, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  requestPermission,
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
  ResultBlock,
  SEOUL_FIXTURE,
  captureLocationError,
  createIdleResult,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

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
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [updateCount, setUpdateCount] = useState(0);
  const [result, setResult] = useState<ScenarioResult>(createIdleResult());
  const [maximumAgeResult, setMaximumAgeResult] = useState<ScenarioResult>(
    createIdleResult()
  );
  const [headingResult, setHeadingResult] = useState<ScenarioResult>(
    createIdleResult()
  );
  const watchTokenRef = useRef<string | null>(null);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCountRef = useRef(0);
  const baselineRef = useRef<GeolocationResponse | null>(null);

  const refreshPermission = async () => {
    const status = await checkPermission();
    setPermissionStatus(status);
    return status;
  };

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
    setResult({
      status: "failed",
      message: getDisplayErrorMessage(error)
    });
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
        setResult({
          status: "running",
          message: `Waiting for simulator fixture, received ${coordinates} (${Math.round(
            fixtureDistance
          )}m away).`
        });
        return;
      }

      baselineRef.current = position;
      setResult({
        status: "running",
        message: `First fixture update captured at ${coordinates}; waiting ${SECOND_UPDATE_WINDOW_MS}ms for distanceFilter=${DISTANCE_FILTER_METERS}m to suppress nearby movement.`
      });

      guardTimerRef.current = setTimeout(() => {
        cleanupWatch();
        setResult({
          status: "passed",
          message: `distanceFilter=${DISTANCE_FILTER_METERS}m did not emit a nearby movement update.`
        });
      }, SECOND_UPDATE_WINDOW_MS);
      return;
    }

    const movedMeters = distanceInMeters(baseline.coords, position.coords);
    if (movedMeters < NEARBY_MOVE_MIN_METERS) {
      setResult({
        status: "running",
        message: `Ignoring duplicate fixture update at ${coordinates}; waiting for distanceFilter=${DISTANCE_FILTER_METERS}m to suppress nearby movement.`
      });
      return;
    }

    if (movedMeters > NEARBY_MOVE_MAX_METERS) {
      setResult({
        status: "running",
        message: `Ignoring far simulator reset at ${coordinates} (${Math.round(
          movedMeters
        )}m from baseline).`
      });
      return;
    }

    cleanupWatch();
    setResult({
      status: "failed",
      message: `Unexpected nearby update #${nextCount} at ${coordinates} (${Math.round(
        movedMeters
      )}m from baseline); distanceFilter=${DISTANCE_FILTER_METERS}m was not honored.`
    });
  };

  const runDistanceFilterGuard = async () => {
    cleanupWatch();
    updateCountRef.current = 0;
    baselineRef.current = null;
    setUpdateCount(0);
    setResult({
      status: "running",
      message: "Starting iOS Release distanceFilter guard"
    });

    try {
      if (Platform.OS !== "ios") {
        throw new Error("This contract is iOS-only.");
      }

      const status = await requestPermission();
      setPermissionStatus(status);
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

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
    setMaximumAgeResult({
      status: "running",
      message: "Seeding native cache, then reading with maximumAge=0"
    });

    try {
      if (Platform.OS !== "ios") {
        throw new Error("This contract is iOS-only.");
      }

      const status = await requestPermission();
      setPermissionStatus(status);
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

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
        setMaximumAgeResult({
          status: "failed",
          message:
            "maximumAge=0 unexpectedly resolved cached data; caller options were dropped before reaching Swift."
        });
      } catch (error) {
        const locationError = captureLocationError(error);
        setMaximumAgeResult({
          status:
            locationError.code === LocationErrorCode.POSITION_UNAVAILABLE
              ? "passed"
              : "failed",
          message: `${locationError.name}: ${locationError.message}`
        });
      }
    } catch (error) {
      setMaximumAgeResult({
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runHeadingFilterGuard = async () => {
    setHeadingResult({
      status: "running",
      message: "Starting heading watch with headingFilter=-1"
    });

    try {
      if (Platform.OS !== "ios") {
        throw new Error("This contract is iOS-only.");
      }

      const status = await requestPermission();
      setPermissionStatus(status);
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

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
        setHeadingResult({
          status: "failed",
          message: `headingFilter=-1 did not reject within ${HEADING_FILTER_WATCHDOG_MS}ms; caller options were dropped before reaching Swift.`
        });
        return;
      }

      if (outcome.type === "resolved") {
        setHeadingResult({
          status: "failed",
          message:
            "headingFilter=-1 unexpectedly emitted a heading; caller options were dropped before reaching Swift."
        });
        return;
      }

      const locationError = captureLocationError(outcome.error);
      setHeadingResult({
        status:
          locationError.code === LocationErrorCode.INTERNAL_ERROR &&
          locationError.message.includes("headingFilter")
            ? "passed"
            : "failed",
        message: `${locationError.name}: ${locationError.message}`
      });
    } catch (error) {
      setHeadingResult({
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  useEffect(() => {
    refreshPermission();
    return cleanupWatch;
  }, []);

  return (
    <ScrollView style={sharedStyles.container} testID={`${PREFIX}-screen`}>
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>iOS Release Options Bridge</Text>
        <Text style={sharedStyles.subtitle}>
          Native Swift optional struct bridge contract
        </Text>
      </View>

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>1. Permission</Text>
        <View style={sharedStyles.statusContainer}>
          <Text style={sharedStyles.statusLabel}>Permission:</Text>
          <Text
            style={sharedStyles.statusValue}
            testID={`${PREFIX}-permission`}
          >
            {permissionStatus}
          </Text>
        </View>
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>2. Distance Filter Guard</Text>
        <Text style={sharedStyles.description}>
          Release bridge regression check for caller options on watchPosition.
        </Text>
        <View style={sharedStyles.statusContainer}>
          <Text style={sharedStyles.statusLabel}>Updates:</Text>
          <Text
            style={sharedStyles.statusValue}
            testID={`${PREFIX}-update-count`}
          >
            {updateCount}
          </Text>
        </View>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Distance Filter Guard"
            onPress={runDistanceFilterGuard}
            testID={`${PREFIX}-run-distance-filter-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="distance-filter"
          label="Distance filter guard"
          result={result}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>
          3. Maximum Age Option Guard
        </Text>
        <Text style={sharedStyles.description}>
          Release bridge regression check that maximumAge=0 filters cached
          locations in native Swift.
        </Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Maximum Age Option Guard"
            onPress={runMaximumAgeZeroGuard}
            testID={`${PREFIX}-run-maximum-age-zero-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="maximum-age-zero"
          label="Maximum age option guard"
          result={maximumAgeResult}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>
          4. Heading Filter Option Guard
        </Text>
        <Text style={sharedStyles.description}>
          Release bridge regression check that headingFilter=-1 reaches native
          Swift validation.
        </Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Heading Filter Option Guard"
            onPress={runHeadingFilterGuard}
            testID={`${PREFIX}-run-heading-filter-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="heading-filter"
          label="Heading filter option guard"
          result={headingResult}
        />
      </View>
    </ScrollView>
  );
}
