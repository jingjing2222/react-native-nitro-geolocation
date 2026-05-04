import React, { useEffect, useState } from "react";
import {
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLocationErrorCodeName,
  requestPermission
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
} from "react-native-nitro-geolocation";

type ScenarioStatus = "idle" | "running" | "passed" | "failed";

type ScenarioResult = {
  status: ScenarioStatus;
  message: string;
};

type AccuracyScenario = {
  id: string;
  title: string;
  options: LocationRequestOptions;
  assertPosition?: (position: GeolocationResponse) => string;
  acceptNoGpsFallbackRejection?: boolean;
};

type PositiveScenarioMessage = {
  id: string;
  title: string;
  message: string;
};

const SEOUL_FIXTURE = {
  latitude: 37.5665,
  longitude: 126.978
};

const COORDINATE_TOLERANCE = 0.02;

const initialResults: Record<string, ScenarioResult> = {
  positive: {
    status: "idle",
    message: "Not run"
  },
  invalid: {
    status: "idle",
    message: "Not run"
  },
  denied: {
    status: "idle",
    message: "Not run"
  }
};

const getDisplayErrorMessage = (error: unknown) => {
  const maybeError = error as { code?: unknown; message?: unknown };
  const code = typeof maybeError.code === "number" ? maybeError.code : null;
  const name = code === null ? "UNKNOWN" : getLocationErrorCodeName(code);
  const message =
    typeof maybeError.message === "string" ? maybeError.message : String(error);

  return code === null ? message : `${name}: ${message}`;
};

const assertFixtureCoordinates = (position: GeolocationResponse) => {
  const latitudeDelta = Math.abs(
    position.coords.latitude - SEOUL_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SEOUL_FIXTURE.longitude
  );

  if (
    !Number.isFinite(position.coords.latitude) ||
    !Number.isFinite(position.coords.longitude)
  ) {
    throw new Error("Position contained non-finite coordinates.");
  }

  if (
    latitudeDelta > COORDINATE_TOLERANCE ||
    longitudeDelta > COORDINATE_TOLERANCE
  ) {
    throw new Error(
      `Position did not match fixture: ${position.coords.latitude.toFixed(
        6
      )}, ${position.coords.longitude.toFixed(6)}.`
    );
  }

  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
};

const assertNotGpsProvider = (position: GeolocationResponse) => {
  const coordinates = assertFixtureCoordinates(position);

  if (Platform.OS === "android" && position.provider === "gps") {
    throw new Error("Explicit non-high preset unexpectedly used GPS.");
  }

  return `${coordinates}, provider=${position.provider ?? "unknown"}`;
};

const isNoGpsFallbackRejection = (error: unknown) => {
  if (Platform.OS !== "android") return false;

  const maybeError = error as { code?: unknown };
  if (typeof maybeError.code !== "number") return false;

  return [
    LocationErrorCode.POSITION_UNAVAILABLE,
    LocationErrorCode.TIMEOUT,
    LocationErrorCode.SETTINGS_NOT_SATISFIED
  ].includes(maybeError.code);
};

const getPositiveScenarios = (): AccuracyScenario[] => {
  if (Platform.OS === "android") {
    return [
      {
        id: "android-high-overrides-false",
        title: "Android high overrides enableHighAccuracy=false",
        options: {
          enableHighAccuracy: false,
          accuracy: {
            android: "high"
          },
          maximumAge: 0,
          timeout: 15000
        }
      },
      {
        id: "android-balanced-overrides-true",
        title: "Android balanced does not fall back to GPS",
        options: {
          enableHighAccuracy: true,
          accuracy: {
            android: "balanced"
          },
          maximumAge: 0,
          timeout: 15000
        },
        assertPosition: assertNotGpsProvider,
        acceptNoGpsFallbackRejection: true
      },
      {
        id: "android-low-no-gps-fallback",
        title: "Android low does not fall back to GPS",
        options: {
          enableHighAccuracy: true,
          accuracy: {
            android: "low"
          },
          maximumAge: 0,
          timeout: 15000
        },
        assertPosition: assertNotGpsProvider,
        acceptNoGpsFallbackRejection: true
      }
    ];
  }

  return [
    {
      id: "ios-best-navigation-overrides-false",
      title: "iOS bestForNavigation overrides enableHighAccuracy=false",
      options: {
        enableHighAccuracy: false,
        accuracy: {
          ios: "bestForNavigation"
        },
        maximumAge: 0,
        timeout: 15000
      }
    },
    {
      id: "ios-nearest-ten",
      title: "iOS nearestTenMeters returns fixture coordinates",
      options: {
        accuracy: {
          ios: "nearestTenMeters"
        },
        maximumAge: 0,
        timeout: 15000
      }
    },
    {
      id: "ios-reduced-overrides-true",
      title: "iOS reduced overrides enableHighAccuracy=true",
      options: {
        enableHighAccuracy: true,
        accuracy: {
          ios: "reduced"
        },
        maximumAge: 0,
        timeout: 15000
      }
    }
  ];
};

export default function AccuracyPresetsScreen() {
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [results, setResults] = useState(initialResults);
  const [scenarioMessages, setScenarioMessages] = useState<
    PositiveScenarioMessage[]
  >([]);

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

  const requestLocationPermission = async () => {
    try {
      const status = await requestPermission();
      setPermissionStatus(status);
      return status;
    } catch (error) {
      const message = getDisplayErrorMessage(error);
      setPermissionStatus(message);
      return message;
    }
  };

  const runPositiveScenarios = async () => {
    setResult("positive", {
      status: "running",
      message: "Running native accuracy preset requests"
    });
    setScenarioMessages([]);

    try {
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const messages: PositiveScenarioMessage[] = [];
      for (const scenario of getPositiveScenarios()) {
        try {
          const position = await getCurrentPosition(scenario.options);
          const summary = scenario.assertPosition
            ? scenario.assertPosition(position)
            : assertFixtureCoordinates(position);
          messages.push({
            id: scenario.id,
            title: scenario.title,
            message: `contract passed with injected location ${summary}`
          });
        } catch (error) {
          if (
            scenario.acceptNoGpsFallbackRejection &&
            isNoGpsFallbackRejection(error)
          ) {
            messages.push({
              id: scenario.id,
              title: scenario.title,
              message: `contract passed by rejecting instead of using GPS (${getDisplayErrorMessage(
                error
              )})`
            });
            continue;
          }

          throw error;
        }
      }

      setScenarioMessages(messages);
      setResult("positive", {
        status: "passed",
        message: `${messages.length} accuracy preset contracts passed.`
      });
    } catch (error) {
      setResult("positive", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runInvalidPresetScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Calling native API with an invalid preset"
    });

    const invalidOptions = {
      accuracy:
        Platform.OS === "android" ? { android: "ultra" } : { ios: "cityBlock" },
      maximumAge: 0,
      timeout: 15000
    } as unknown as LocationRequestOptions;

    try {
      await getCurrentPosition(invalidOptions);
      setResult("invalid", {
        status: "failed",
        message: "Invalid preset unexpectedly resolved."
      });
    } catch (error) {
      setResult("invalid", {
        status: "passed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runPermissionDeniedScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Calling native API without location permission"
    });

    const options: LocationRequestOptions =
      Platform.OS === "android"
        ? {
            accuracy: {
              android: "balanced"
            },
            timeout: 5000
          }
        : {
            accuracy: {
              ios: "best"
            },
            timeout: 5000
          };

    try {
      await getCurrentPosition(options);
      setResult("denied", {
        status: "failed",
        message: "Permission-denied request unexpectedly resolved."
      });
    } catch (error) {
      const maybeError = error as { code?: unknown };
      const code =
        typeof maybeError.code === "number"
          ? maybeError.code
          : LocationErrorCode.INTERNAL_ERROR;

      setResult("denied", {
        status:
          code === LocationErrorCode.PERMISSION_DENIED ? "passed" : "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  useEffect(() => {
    refreshPermission();
  }, []);

  return (
    <ScrollView style={styles.container} testID="accuracy-presets-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Accuracy Presets</Text>
        <Text style={styles.subtitle}>
          Native request contract for platform accuracy options
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Permission</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Permission:</Text>
          <Text style={styles.statusValue} testID="accuracy-presets-permission">
            {permissionStatus}
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title="Request Permission"
            onPress={requestLocationPermission}
            color="#4CAF50"
            testID="accuracy-presets-request-permission-button"
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Positive Presets</Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Run Preset Requests"
            onPress={runPositiveScenarios}
            color="#1976D2"
            testID="accuracy-presets-run-positive-button"
          />
        </View>
        <ResultBlock
          id="positive"
          label="Positive presets"
          result={results.positive}
        />
        {scenarioMessages.map((scenario, index) => (
          <View
            key={scenario.id}
            style={styles.scenarioContainer}
            testID={`accuracy-presets-scenario-${index}`}
          >
            <Text
              style={styles.scenarioTitle}
              testID={`accuracy-presets-scenario-${index}-title`}
            >
              {scenario.title}
            </Text>
            <Text
              style={styles.scenarioText}
              testID={`accuracy-presets-scenario-${index}-message`}
            >
              {scenario.message}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Invalid Preset</Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Run Invalid Preset"
            onPress={runInvalidPresetScenario}
            color="#D84315"
            testID="accuracy-presets-run-invalid-button"
          />
        </View>
        <ResultBlock
          id="invalid"
          label="Invalid preset"
          result={results.invalid}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Permission Denied</Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Run Denied Request"
            onPress={runPermissionDeniedScenario}
            color="#7B1FA2"
            testID="accuracy-presets-run-denied-button"
          />
        </View>
        <ResultBlock
          id="denied"
          label="Permission denied"
          result={results.denied}
        />
      </View>
    </ScrollView>
  );
}

function ResultBlock({
  id,
  label,
  result
}: {
  id: string;
  label: string;
  result: ScenarioResult;
}) {
  return (
    <View
      style={[
        styles.resultContainer,
        result.status === "passed" && styles.resultPassed,
        result.status === "failed" && styles.resultFailed
      ]}
      testID={`accuracy-presets-${id}-result`}
    >
      <Text
        style={styles.resultStatus}
        testID={`accuracy-presets-${id}-status`}
      >
        {label}: {result.status}
      </Text>
      <Text
        style={styles.resultMessage}
        testID={`accuracy-presets-${id}-message`}
      >
        {result.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  header: {
    padding: 20,
    backgroundColor: "#37474F"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: "#ECEFF1"
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12
  },
  statusContainer: {
    backgroundColor: "#ECEFF1",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  statusLabel: {
    fontSize: 14,
    color: "#455A64",
    fontWeight: "600"
  },
  statusValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
    marginTop: 4
  },
  buttonContainer: {
    marginVertical: 8
  },
  resultContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginTop: 8
  },
  resultPassed: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50"
  },
  resultFailed: {
    backgroundColor: "#FFEBEE",
    borderColor: "#E53935"
  },
  resultStatus: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4
  },
  resultMessage: {
    fontSize: 13,
    color: "#424242"
  },
  scenarioContainer: {
    marginTop: 8
  },
  scenarioTitle: {
    fontSize: 12,
    color: "#000",
    fontWeight: "700"
  },
  scenarioText: {
    fontSize: 12,
    color: "#263238",
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0"
  }
});
