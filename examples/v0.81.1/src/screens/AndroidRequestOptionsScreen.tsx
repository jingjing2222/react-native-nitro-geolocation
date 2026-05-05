import React, { useEffect, useState } from "react";
import { Button, Platform, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  requestPermission,
  setConfiguration,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
} from "react-native-nitro-geolocation";
import {
  ResultBlock,
  assertFixtureCoordinates,
  assertLocationErrorCode,
  createIdleResult,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

const PREFIX = "android-request-options";
const FIXTURE_LATITUDE = 37.5665;
const FIXTURE_LONGITUDE = 126.978;
const WATCH_TIMEOUT_MS = 20000;

const initialResults = {
  fused: createIdleResult(),
  coarseCache: createIdleResult(),
  mixedWatch: createIdleResult(),
  maxUpdates: createIdleResult(),
  invalid: createIdleResult(),
  fineDenied: createIdleResult()
};

const assertFinitePosition = (position: GeolocationResponse) => {
  if (
    !Number.isFinite(position.coords.latitude) ||
    !Number.isFinite(position.coords.longitude)
  ) {
    throw new Error("Watch position contained non-finite coordinates.");
  }
};

const assertNotExactFixtureCoordinates = (position: GeolocationResponse) => {
  const latitudeDelta = Math.abs(position.coords.latitude - FIXTURE_LATITUDE);
  const longitudeDelta = Math.abs(
    position.coords.longitude - FIXTURE_LONGITUDE
  );

  if (latitudeDelta < 0.00001 && longitudeDelta < 0.00001) {
    throw new Error(
      "Coarse watcher received the exact injected fine coordinates."
    );
  }
};

export default function AndroidRequestOptionsScreen() {
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [results, setResults] = useState(initialResults);

  const setResult = (
    key: keyof typeof initialResults,
    result: ScenarioResult
  ) => {
    setResults((previous) => ({
      ...previous,
      [key]: result
    }));
  };

  const refreshPermission = async () => {
    const status = await checkPermission();
    setPermissionStatus(status);
    return status;
  };

  const ensurePermission = async () => {
    const status = await requestPermission();
    setPermissionStatus(status);
    if (status !== "granted") {
      throw new Error(`Permission was not granted: ${status}`);
    }
  };

  const configurePlayServices = () => {
    setConfiguration({
      locationProvider: Platform.OS === "android" ? "playServices" : "auto"
    });
  };

  const runFusedRequestScenario = async () => {
    setResult("fused", {
      status: "running",
      message: "Requesting high accuracy with coarse granularity through Fused"
    });

    try {
      await ensurePermission();
      configurePlayServices();

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
          timeout: 15000
        })
      );
      const coordinates = assertFixtureCoordinates(position);

      if (Platform.OS === "android" && position.provider === "gps") {
        throw new Error("coarse granularity unexpectedly returned GPS.");
      }

      setResult("fused", {
        status: "passed",
        message: `Fused coarse request returned ${coordinates}; provider=${position.provider ?? "unknown"}.`
      });
    } catch (error) {
      setResult("fused", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runMaxUpdatesScenario = async () => {
    setResult("maxUpdates", {
      status: "running",
      message: "Watching location until maxUpdates stops the subscription"
    });

    try {
      await ensurePermission();
      configurePlayServices();
      const readings: GeolocationResponse[] = [];
      let token = "";

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let didFinish = false;
            const timeout = setTimeout(() => {
              if (didFinish) return;
              didFinish = true;
              if (token) {
                unwatch(token);
              }
              reject(
                new Error(
                  `Expected 1 watch update, received ${readings.length}.`
                )
              );
            }, WATCH_TIMEOUT_MS);

            token = watchPosition(
              (position) => {
                if (didFinish) return;

                try {
                  assertFinitePosition(position);
                  readings.push(position);

                  if (readings.length === 1) {
                    setTimeout(() => {
                      if (didFinish) return;
                      didFinish = true;
                      clearTimeout(timeout);
                      unwatch(token);
                      resolve();
                    }, 1500);
                  } else if (readings.length > 1) {
                    didFinish = true;
                    clearTimeout(timeout);
                    unwatch(token);
                    reject(
                      new Error("maxUpdates allowed more than one update.")
                    );
                  }
                } catch (error) {
                  didFinish = true;
                  clearTimeout(timeout);
                  unwatch(token);
                  reject(error);
                }
              },
              (error) => {
                if (didFinish) return;
                didFinish = true;
                clearTimeout(timeout);
                if (token) {
                  unwatch(token);
                }
                reject(error);
              },
              {
                accuracy: {
                  android: "high"
                },
                granularity: "permission",
                interval: 500,
                fastestInterval: 100,
                maxUpdateDelay: 0,
                maxUpdates: 1
              }
            );
          })
      );

      setResult("maxUpdates", {
        status: "passed",
        message: `Watch stopped after ${readings.length} update with maxUpdates=1.`
      });
    } catch (error) {
      setResult("maxUpdates", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runCoarseCacheScenario = async () => {
    setResult("coarseCache", {
      status: "running",
      message: "Seeding a fine fused fix before a coarse cache-only read"
    });

    try {
      await ensurePermission();
      configurePlayServices();

      await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "high"
          },
          granularity: "fine",
          maximumAge: 0,
          timeout: 15000
        })
      );

      await runWithNativeGeolocation(() =>
        getLastKnownPosition({
          granularity: "coarse"
        })
      );

      setResult("coarseCache", {
        status: "failed",
        message: "Coarse cache read unexpectedly returned a fused fine fix."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.POSITION_UNAVAILABLE
        );
        setResult("coarseCache", {
          status: "passed",
          message: `${locationError.name}: coarse cache-only read did not reuse an ungranular fused lastLocation.`
        });
      } catch (assertionError) {
        setResult("coarseCache", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    } finally {
      await refreshPermission();
    }
  };

  const runMixedWatchScenario = async () => {
    setResult("mixedWatch", {
      status: "running",
      message: "Starting simultaneous coarse and fine Fused watches"
    });

    try {
      await ensurePermission();
      configurePlayServices();

      let coarseReading: GeolocationResponse | undefined;
      let fineReading: GeolocationResponse | undefined;

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let coarseToken = "";
            let fineToken = "";
            let didFinish = false;

            const cleanup = () => {
              if (coarseToken) {
                unwatch(coarseToken);
              }
              if (fineToken) {
                unwatch(fineToken);
              }
            };

            const timeout = setTimeout(() => {
              if (didFinish) return;
              didFinish = true;
              cleanup();
              reject(
                new Error(
                  `Expected mixed watch readings; coarse=${Boolean(coarseReading)} fine=${Boolean(fineReading)}.`
                )
              );
            }, WATCH_TIMEOUT_MS);

            const finishIfReady = () => {
              if (!coarseReading || !fineReading || didFinish) return;
              didFinish = true;
              clearTimeout(timeout);
              cleanup();
              resolve();
            };

            const fail = (error: unknown) => {
              if (didFinish) return;
              didFinish = true;
              clearTimeout(timeout);
              cleanup();
              reject(error);
            };

            coarseToken = watchPosition(
              (position) => {
                try {
                  assertFinitePosition(position);
                  coarseReading = position;
                  finishIfReady();
                } catch (error) {
                  fail(error);
                }
              },
              fail,
              {
                accuracy: {
                  android: "high"
                },
                granularity: "coarse",
                interval: 500,
                fastestInterval: 100,
                maxUpdateDelay: 0
              }
            );

            fineToken = watchPosition(
              (position) => {
                try {
                  assertFinitePosition(position);
                  fineReading = position;
                  finishIfReady();
                } catch (error) {
                  fail(error);
                }
              },
              fail,
              {
                accuracy: {
                  android: "high"
                },
                granularity: "fine",
                interval: 500,
                fastestInterval: 100,
                maxUpdateDelay: 0
              }
            );
          })
      );

      if (!coarseReading || !fineReading) {
        throw new Error("Mixed watch did not deliver both subscriptions.");
      }

      const coarseCoordinates = assertFixtureCoordinates(coarseReading);
      const fineCoordinates = assertFixtureCoordinates(fineReading);
      assertNotExactFixtureCoordinates(coarseReading);

      if (coarseReading.provider === "gps") {
        throw new Error("Coarse watcher unexpectedly received GPS.");
      }

      setResult("mixedWatch", {
        status: "passed",
        message: `Coarse watcher stayed coarse at ${coarseCoordinates}; fine watcher received ${fineCoordinates}.`
      });
    } catch (error) {
      setResult("mixedWatch", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runInvalidMaxUpdatesScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Starting a watch with maxUpdates=0"
    });

    try {
      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let token = "";
            let didFinish = false;
            token = watchPosition(
              () => {
                if (didFinish) return;
                didFinish = true;
                if (token) {
                  unwatch(token);
                }
                reject(new Error("Invalid maxUpdates unexpectedly emitted."));
              },
              (error) => {
                if (didFinish) return;
                didFinish = true;
                if (token) {
                  unwatch(token);
                }
                try {
                  assertLocationErrorCode(
                    error,
                    LocationErrorCode.INTERNAL_ERROR
                  );
                  resolve();
                } catch (assertionError) {
                  reject(assertionError);
                }
              },
              {
                maxUpdates: 0
              } as LocationRequestOptions
            );
          })
      );

      setResult("invalid", {
        status: "passed",
        message: "maxUpdates=0 rejected before starting native updates."
      });
    } catch (error) {
      setResult("invalid", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runFineDeniedScenario = async () => {
    setResult("fineDenied", {
      status: "running",
      message: "Requesting fine granularity with coarse-only permission"
    });

    try {
      configurePlayServices();
      await runWithNativeGeolocation(() =>
        getCurrentPosition({
          granularity: "fine",
          maximumAge: 0,
          timeout: 5000
        })
      );

      setResult("fineDenied", {
        status: "failed",
        message: "Fine granularity unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.PERMISSION_DENIED
        );
        setResult("fineDenied", {
          status: "passed",
          message: `${locationError.name}: coarse-only permission cannot satisfy granularity=fine.`
        });
      } catch (assertionError) {
        setResult("fineDenied", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    } finally {
      await refreshPermission();
    }
  };

  useEffect(() => {
    refreshPermission();
  }, []);

  return (
    <ScrollView style={sharedStyles.container} testID={`${PREFIX}-screen`}>
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>Android Request Options</Text>
        <Text style={sharedStyles.subtitle}>
          Fused request controls with update limits and rejection paths
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
        <Text style={sharedStyles.sectionTitle}>2. Fused Coarse Request</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Fused Request"
            onPress={runFusedRequestScenario}
            color="#1976D2"
            testID={`${PREFIX}-run-fused-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="fused"
          label="Fused request"
          result={results.fused}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>3. Coarse Cache Isolation</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Coarse Cache Isolation"
            onPress={runCoarseCacheScenario}
            color="#5E35B1"
            testID={`${PREFIX}-run-coarse-cache-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="coarse-cache"
          label="Coarse cache"
          result={results.coarseCache}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>
          4. Mixed Watch Granularity
        </Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Mixed Watch Granularity"
            onPress={runMixedWatchScenario}
            color="#455A64"
            testID={`${PREFIX}-run-mixed-watch-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="mixed-watch"
          label="Mixed watch"
          result={results.mixedWatch}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>5. Max Updates Watch</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Max Updates Watch"
            onPress={runMaxUpdatesScenario}
            color="#00897B"
            testID={`${PREFIX}-run-max-updates-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="max-updates"
          label="Max updates"
          result={results.maxUpdates}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>6. Invalid Max Updates</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Invalid Max Updates"
            onPress={runInvalidMaxUpdatesScenario}
            color="#D84315"
            testID={`${PREFIX}-run-invalid-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid maxUpdates"
          result={results.invalid}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>7. Fine Permission Gate</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Fine Permission Gate"
            onPress={runFineDeniedScenario}
            color="#7B1FA2"
            testID={`${PREFIX}-run-fine-denied-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="fine-denied"
          label="Fine permission"
          result={results.fineDenied}
        />
      </View>
    </ScrollView>
  );
}
