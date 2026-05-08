import React from "react";
import { Text, View } from "react-native";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import { sharedStyles } from "../styles";

/**
 * Optional testID map for each rendered `PositionInfo` field.
 *
 * @example
 * ```ts
 * const testIDs: PositionInfoTestIDs = {
 *   container: "position-info",
 *   latitude: "latitude-text",
 *   longitude: "longitude-text",
 *   accuracy: "accuracy-text"
 * };
 * ```
 */
export type PositionInfoTestIDs = {
  /** Optional Maestro testID attached to the outer position card. */
  container?: string;
  /** Optional Maestro testID attached to the latitude row. */
  latitude?: string;
  /** Optional Maestro testID attached to the longitude row. */
  longitude?: string;
  /** Optional Maestro testID attached to the horizontal accuracy row. */
  accuracy?: string;
  /** Optional Maestro testID attached to the mocked metadata row. */
  mocked?: string;
  /** Optional Maestro testID attached to the provider metadata row. */
  provider?: string;
  /** Optional Maestro testID attached to the altitude row. */
  altitude?: string;
  /** Optional Maestro testID attached to the speed row. */
  speed?: string;
  /** Optional Maestro testID attached to the heading row. */
  heading?: string;
  /** Optional Maestro testID attached to the timestamp row. */
  time?: string;
  /** Optional Maestro testID attached to the title text. */
  title?: string;
};

/**
 * Props for `PositionInfo`.
 *
 * @example
 * ```tsx
 * const props: PositionInfoProps = {
 *   title: "Current Position",
 *   position: currentPosition,
 *   includeOptionalFields: false
 * };
 * ```
 */
export type PositionInfoProps = {
  /** Native geolocation response to render, or `null` to render nothing. */
  position: GeolocationResponse | null;
  /** Title shown at the top of the position card. */
  title: string;
  /** Explicit Maestro testIDs for fields that existing flows already target. */
  testIDs?: PositionInfoTestIDs;
  /** Whether to render optional native metadata beyond lat/lng/accuracy. */
  includeOptionalFields?: boolean;
};

/**
 * Standard native position display block.
 *
 * The component preserves existing Maestro contracts by accepting explicit
 * testIDs for every rendered field. Pass `includeOptionalFields={false}` when
 * a test only cares about latitude, longitude, and accuracy.
 *
 * @example
 * ```tsx
 * <PositionInfo
 *   title="Current Position"
 *   position={currentPosition}
 *   testIDs={{
 *     container: "position-info",
 *     latitude: "latitude-text",
 *     longitude: "longitude-text",
 *     accuracy: "accuracy-text",
 *     mocked: "mocked-text",
 *     provider: "provider-text"
 *   }}
 * />
 * ```
 *
 * @param {PositionInfoProps} props - The props object passed to the
 * `PositionInfo` component.
 * @param {GeolocationResponse | null} props.position - Native position to
 * render. When this value is `null`, the component returns `null` and renders
 * no position card.
 * @param {string} props.title - Title rendered at the top of the position card,
 * such as `Current Position`, `Watch Position`, or `Provider Position`.
 * @param {PositionInfoTestIDs} [props.testIDs = {}] - Optional map of Maestro
 * testIDs for preserving existing field-level E2E contracts.
 * @param {string} [props.testIDs.container] - Optional testID attached to the
 * outer position card, for example `position-info`.
 * @param {string} [props.testIDs.title] - Optional testID attached to the title
 * text. Default value is `undefined`.
 * @param {string} [props.testIDs.latitude] - Optional testID attached to the
 * latitude row, for example `latitude-text`.
 * @param {string} [props.testIDs.longitude] - Optional testID attached to the
 * longitude row, for example `longitude-text`.
 * @param {string} [props.testIDs.accuracy] - Optional testID attached to the
 * horizontal accuracy row, for example `accuracy-text`.
 * @param {string} [props.testIDs.mocked] - Optional testID attached to the
 * Android/iOS mocked metadata row when `position.mocked` is present.
 * @param {string} [props.testIDs.provider] - Optional testID attached to the
 * provider metadata row when `position.provider` is present.
 * @param {string} [props.testIDs.altitude] - Optional testID attached to the
 * altitude row when `position.coords.altitude` is not `null`.
 * @param {string} [props.testIDs.speed] - Optional testID attached to the speed
 * row when `position.coords.speed` is not `null`.
 * @param {string} [props.testIDs.heading] - Optional testID attached to the
 * heading row when `position.coords.heading` is not `null`.
 * @param {string} [props.testIDs.time] - Optional testID attached to the
 * timestamp row when optional fields are rendered.
 * @param {boolean} [props.includeOptionalFields = true] - Whether to render
 * optional native metadata beyond latitude, longitude, and accuracy. Set this
 * to `false` when a legacy Maestro flow only asserts the basic fields.
 * @returns {React.JSX.Element | null} A shared position card, or `null` when
 * `props.position` is `null`.
 */
export function PositionInfo({
  position,
  title,
  testIDs = {},
  includeOptionalFields = true
}: PositionInfoProps) {
  if (!position) return null;

  return (
    <View style={sharedStyles.positionContainer} testID={testIDs.container}>
      <Text style={sharedStyles.positionTitle} testID={testIDs.title}>
        {title}
      </Text>
      <Text style={sharedStyles.positionText} testID={testIDs.latitude}>
        Latitude: {position.coords.latitude.toFixed(6)}
      </Text>
      <Text style={sharedStyles.positionText} testID={testIDs.longitude}>
        Longitude: {position.coords.longitude.toFixed(6)}
      </Text>
      <Text style={sharedStyles.positionText} testID={testIDs.accuracy}>
        Accuracy: {position.coords.accuracy.toFixed(2)}m
      </Text>
      {includeOptionalFields && position.mocked !== undefined && (
        <Text style={sharedStyles.positionText} testID={testIDs.mocked}>
          Mocked: {position.mocked ? "true" : "false"}
        </Text>
      )}
      {includeOptionalFields && position.provider !== undefined && (
        <Text style={sharedStyles.positionText} testID={testIDs.provider}>
          Provider: {position.provider}
        </Text>
      )}
      {includeOptionalFields && position.coords.altitude !== null && (
        <Text style={sharedStyles.positionText} testID={testIDs.altitude}>
          Altitude: {position.coords.altitude.toFixed(2)}m
        </Text>
      )}
      {includeOptionalFields && position.coords.speed !== null && (
        <Text style={sharedStyles.positionText} testID={testIDs.speed}>
          Speed: {position.coords.speed.toFixed(2)}m/s
        </Text>
      )}
      {includeOptionalFields && position.coords.heading !== null && (
        <Text style={sharedStyles.positionText} testID={testIDs.heading}>
          Heading: {position.coords.heading.toFixed(2)}deg
        </Text>
      )}
      {includeOptionalFields ? (
        <Text style={sharedStyles.positionText} testID={testIDs.time}>
          Time: {new Date(position.timestamp).toLocaleString()}
        </Text>
      ) : null}
    </View>
  );
}
