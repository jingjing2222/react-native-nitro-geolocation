import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  LocationErrorCode,
  getLocationErrorCodeName
} from "react-native-nitro-geolocation";
import type {
  AccuracyAuthorization,
  GeolocationResponse
} from "react-native-nitro-geolocation";

export type ScenarioStatus = "idle" | "running" | "passed" | "failed";

export type ScenarioResult = {
  status: ScenarioStatus;
  message: string;
};

export type CapturedLocationError = {
  code: number;
  name: string;
  message: string;
};

export const SEOUL_FIXTURE = {
  latitude: 37.5665,
  longitude: 126.978
};

const COORDINATE_TOLERANCE = 0.02;

export const createIdleResult = (): ScenarioResult => ({
  status: "idle",
  message: "Not run"
});

export const captureLocationError = (error: unknown): CapturedLocationError => {
  const maybeError = error as { code?: unknown; message?: unknown };
  const code =
    typeof maybeError.code === "number"
      ? maybeError.code
      : LocationErrorCode.INTERNAL_ERROR;
  const message =
    typeof maybeError.message === "string" ? maybeError.message : String(error);

  return {
    code,
    name: getLocationErrorCodeName(code),
    message
  };
};

export const getDisplayErrorMessage = (error: unknown) => {
  const locationError = captureLocationError(error);

  return `${locationError.name}: ${locationError.message}`;
};

export const assertLocationErrorCode = (
  error: unknown,
  expectedCode: LocationErrorCode
) => {
  const locationError = captureLocationError(error);

  if (locationError.code !== expectedCode) {
    throw new Error(
      `Expected ${getLocationErrorCodeName(
        expectedCode
      )}, received ${locationError.name}: ${locationError.message}`
    );
  }

  return locationError;
};

export const assertFixtureCoordinates = (position: GeolocationResponse) => {
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

export const assertKnownAccuracyAuthorization = (
  authorization: AccuracyAuthorization
) => {
  if (!["full", "reduced", "unknown"].includes(authorization)) {
    throw new Error(`Unexpected accuracy authorization: ${authorization}`);
  }

  return authorization;
};

export const assertGrantedAccuracyAuthorization = (
  authorization: AccuracyAuthorization
) => {
  if (!["full", "reduced"].includes(authorization)) {
    throw new Error(
      `Expected full or reduced accuracy authorization, received ${authorization}`
    );
  }

  return authorization;
};

export function ResultBlock({
  prefix,
  id,
  label,
  result
}: {
  prefix: string;
  id: string;
  label: string;
  result: ScenarioResult;
}) {
  return (
    <View
      style={[
        sharedStyles.resultContainer,
        result.status === "passed" && sharedStyles.resultPassed,
        result.status === "failed" && sharedStyles.resultFailed
      ]}
      testID={`${prefix}-${id}-result`}
    >
      <Text style={sharedStyles.resultStatus} testID={`${prefix}-${id}-status`}>
        {label}: {result.status}
      </Text>
      <Text
        style={sharedStyles.resultMessage}
        testID={`${prefix}-${id}-message`}
      >
        {result.message}
      </Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC"
  },
  header: {
    backgroundColor: "#111827",
    padding: 20,
    paddingTop: 56
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    color: "#D1D5DB",
    fontSize: 15,
    marginTop: 8
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12
  },
  description: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14
  },
  divider: {
    backgroundColor: "#E5E7EB",
    height: 1,
    marginHorizontal: 20
  },
  buttonContainer: {
    marginBottom: 12
  },
  statusContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 12
  },
  statusLabel: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
    marginRight: 8
  },
  statusValue: {
    color: "#111827",
    flex: 1,
    fontSize: 15
  },
  resultContainer: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 14
  },
  resultPassed: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981"
  },
  resultFailed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444"
  },
  resultStatus: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6
  },
  resultMessage: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20
  }
});
