import React, { useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  geocode,
  reverseGeocode
} from "react-native-nitro-geolocation";
import type {
  GeocodedLocation,
  ReverseGeocodedAddress
} from "react-native-nitro-geolocation";
import {
  ResultBlock,
  SEOUL_FIXTURE,
  assertLocationErrorCode,
  createIdleResult,
  getDisplayErrorMessage,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

const PREFIX = "geocoding";
const ADDRESS_QUERY = "City Hall, Seoul, South Korea";
const SEOUL_GEOCODE_MAX_DELTA = 0.25;
const INVALID_COORDS = {
  latitude: 1234,
  longitude: SEOUL_FIXTURE.longitude
};

const formatLocation = (location: GeocodedLocation) => {
  const accuracy = location.accuracy;
  const accuracyText =
    typeof accuracy === "number" && Number.isFinite(accuracy)
      ? `, accuracy ${accuracy.toFixed(1)}m`
      : "";

  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(
    6
  )}${accuracyText}`;
};

const getReadableAddressField = (address: ReverseGeocodedAddress) => {
  return (
    address.formattedAddress ??
    address.city ??
    address.district ??
    address.region ??
    address.country ??
    address.street ??
    address.postalCode
  );
};

const isNearSeoulFixture = (location: GeocodedLocation) => {
  return (
    Math.abs(location.latitude - SEOUL_FIXTURE.latitude) <=
      SEOUL_GEOCODE_MAX_DELTA &&
    Math.abs(location.longitude - SEOUL_FIXTURE.longitude) <=
      SEOUL_GEOCODE_MAX_DELTA
  );
};

const assertGeocodeResults = (locations: GeocodedLocation[]) => {
  const firstUsableLocation = locations.find(
    (location) =>
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180 &&
      isNearSeoulFixture(location)
  );

  if (!firstUsableLocation) {
    throw new Error("No geocoded candidate was near the Seoul fixture.");
  }

  return `${locations.length} candidate(s), first ${formatLocation(
    firstUsableLocation
  )}`;
};

const assertReverseGeocodeResults = (addresses: ReverseGeocodedAddress[]) => {
  const firstReadableAddress = addresses.find(getReadableAddressField);

  if (!firstReadableAddress) {
    throw new Error("No reverse geocoded candidate contained readable fields.");
  }

  return `${addresses.length} candidate(s), first ${
    getReadableAddressField(firstReadableAddress) ?? "unknown"
  }`;
};

const expectLocationError = async (
  operation: () => Promise<unknown>,
  expectedCode: LocationErrorCode
) => {
  try {
    await operation();
  } catch (error) {
    const locationError = assertLocationErrorCode(error, expectedCode);
    return `${locationError.name}: ${locationError.message}`;
  }

  throw new Error("Expected the geocoding operation to reject.");
};

export default function GeocodingScreen() {
  const [geocodeResult, setGeocodeResult] =
    useState<ScenarioResult>(createIdleResult);
  const [reverseResult, setReverseResult] =
    useState<ScenarioResult>(createIdleResult);
  const [emptyAddressResult, setEmptyAddressResult] =
    useState<ScenarioResult>(createIdleResult);
  const [invalidCoordsResult, setInvalidCoordsResult] =
    useState<ScenarioResult>(createIdleResult);

  const runPositiveScenarios = async () => {
    setGeocodeResult({ status: "running", message: ADDRESS_QUERY });
    setReverseResult({
      status: "running",
      message: `${SEOUL_FIXTURE.latitude}, ${SEOUL_FIXTURE.longitude}`
    });

    try {
      const locations = await geocode(ADDRESS_QUERY);
      setGeocodeResult({
        status: "passed",
        message: assertGeocodeResults(locations)
      });
    } catch (error) {
      setGeocodeResult({
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }

    try {
      const addresses = await reverseGeocode(SEOUL_FIXTURE);
      setReverseResult({
        status: "passed",
        message: assertReverseGeocodeResults(addresses)
      });
    } catch (error) {
      setReverseResult({
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runNegativeScenarios = async () => {
    setEmptyAddressResult({ status: "running", message: "Blank address" });
    setInvalidCoordsResult({
      status: "running",
      message: `${INVALID_COORDS.latitude}, ${INVALID_COORDS.longitude}`
    });

    try {
      setEmptyAddressResult({
        status: "passed",
        message: await expectLocationError(
          () => geocode("   "),
          LocationErrorCode.INTERNAL_ERROR
        )
      });
    } catch (error) {
      setEmptyAddressResult({
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }

    try {
      setInvalidCoordsResult({
        status: "passed",
        message: await expectLocationError(
          () => reverseGeocode(INVALID_COORDS),
          LocationErrorCode.INTERNAL_ERROR
        )
      });
    } catch (error) {
      setInvalidCoordsResult({
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  return (
    <ScrollView style={sharedStyles.container} testID={`${PREFIX}-screen`}>
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>Geocoding</Text>
        <Text style={sharedStyles.subtitle}>
          Native address and coordinate conversion
        </Text>
      </View>

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>1. Positive Scenarios</Text>
        <Text style={sharedStyles.description}>
          Resolve an address to coordinates and Seoul fixture coordinates to a
          readable address through the native platform geocoder.
        </Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Positive Geocoding"
            onPress={runPositiveScenarios}
            color="#2563EB"
            testID={`${PREFIX}-run-positive-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="geocode"
          label="Geocode"
          result={geocodeResult}
        />
        <ResultBlock
          prefix={PREFIX}
          id="reverse"
          label="Reverse geocode"
          result={reverseResult}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>2. Negative Scenarios</Text>
        <Text style={sharedStyles.description}>
          Invalid user input should reject with the Modern API structured error
          contract instead of rendering a synthetic pass state.
        </Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Negative Geocoding"
            onPress={runNegativeScenarios}
            color="#B91C1C"
            testID={`${PREFIX}-run-negative-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="empty-address"
          label="Empty address"
          result={emptyAddressResult}
        />
        <ResultBlock
          prefix={PREFIX}
          id="invalid-coords"
          label="Invalid coordinates"
          result={invalidCoordsResult}
        />
      </View>
    </ScrollView>
  );
}
