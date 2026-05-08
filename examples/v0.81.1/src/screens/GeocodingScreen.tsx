import React from "react";
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
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertLocationErrorCode,
  createScenarioResults,
  getDisplayErrorMessage,
  useScenarioResults
} from "./scenario";

const PREFIX = "geocoding";
const ADDRESS_QUERY = "City Hall, Seoul, South Korea";
const SEOUL_GEOCODE_MAX_DELTA = 0.25;
const INVALID_COORDS = {
  latitude: 1234,
  longitude: SEOUL_FIXTURE.longitude
};

const initialResults = createScenarioResults([
  "geocode",
  "reverse",
  "emptyAddress",
  "invalidCoords"
] as const);

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
  const { results, setResult } = useScenarioResults(initialResults);

  const runPositiveScenarios = async () => {
    setResult("geocode", { status: "running", message: ADDRESS_QUERY });
    setResult("reverse", {
      status: "running",
      message: `${SEOUL_FIXTURE.latitude}, ${SEOUL_FIXTURE.longitude}`
    });

    try {
      const locations = await geocode(ADDRESS_QUERY);
      setResult("geocode", {
        status: "passed",
        message: assertGeocodeResults(locations)
      });
    } catch (error) {
      setResult("geocode", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }

    try {
      const addresses = await reverseGeocode(SEOUL_FIXTURE);
      setResult("reverse", {
        status: "passed",
        message: assertReverseGeocodeResults(addresses)
      });
    } catch (error) {
      setResult("reverse", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runNegativeScenarios = async () => {
    setResult("emptyAddress", { status: "running", message: "Blank address" });
    setResult("invalidCoords", {
      status: "running",
      message: `${INVALID_COORDS.latitude}, ${INVALID_COORDS.longitude}`
    });

    try {
      setResult("emptyAddress", {
        status: "passed",
        message: await expectLocationError(
          () => geocode("   "),
          LocationErrorCode.INTERNAL_ERROR
        )
      });
    } catch (error) {
      setResult("emptyAddress", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }

    try {
      setResult("invalidCoords", {
        status: "passed",
        message: await expectLocationError(
          () => reverseGeocode(INVALID_COORDS),
          LocationErrorCode.INTERNAL_ERROR
        )
      });
    } catch (error) {
      setResult("invalidCoords", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Geocoding"
      subtitle="Native address and coordinate conversion"
    >
      <ScenarioSection
        index={1}
        title="Positive Scenarios"
        description="Resolve an address to coordinates and Seoul fixture coordinates to a readable address through the native platform geocoder."
      >
        <ScenarioButton
          title="Run Positive Geocoding"
          onPress={runPositiveScenarios}
          color="#2563EB"
          testID={`${PREFIX}-run-positive-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="geocode"
          label="Geocode"
          result={results.geocode}
        />
        <ResultBlock
          prefix={PREFIX}
          id="reverse"
          label="Reverse geocode"
          result={results.reverse}
        />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Negative Scenarios"
        description="Invalid user input should reject with the Modern API structured error contract instead of rendering a synthetic pass state."
        divided
      >
        <ScenarioButton
          title="Run Negative Geocoding"
          onPress={runNegativeScenarios}
          color="#B91C1C"
          testID={`${PREFIX}-run-negative-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="empty-address"
          label="Empty address"
          result={results.emptyAddress}
        />
        <ResultBlock
          prefix={PREFIX}
          id="invalid-coords"
          label="Invalid coordinates"
          result={results.invalidCoords}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
