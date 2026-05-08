import React from "react";
import { Text, View } from "react-native";
import { sharedStyles } from "../styles";

/**
 * Props for `ErrorBlock`.
 *
 * @example
 * ```tsx
 * const props: ErrorBlockProps = {
 *   message: "Location permission was denied.",
 *   testID: "current-position-error",
 *   textTestID: "current-position-error-text"
 * };
 * ```
 */
export type ErrorBlockProps = {
  /** User-visible error message rendered after the `Error:` prefix. */
  message: string;
  /** Optional Maestro testID attached to the outer error card. */
  testID?: string;
  /** Optional Maestro testID attached to the rendered message text. */
  textTestID?: string;
};

/**
 * Standard error card for user-visible E2E failure state.
 *
 * Pass both container and text testIDs when Maestro needs to assert either the
 * card exists or the rendered message text.
 *
 * @example
 * ```tsx
 * <ErrorBlock
 *   message={currentPositionError}
 *   testID="current-position-error"
 *   textTestID="current-position-error-text"
 * />
 * ```
 *
 * @param {ErrorBlockProps} props - The props object passed to the `ErrorBlock`
 * component.
 * @param {string} props.message - User-visible error detail rendered after the
 * fixed `Error:` prefix.
 * @param {string} [props.testID] - Optional Maestro testID attached to the
 * outer error card, useful for asserting that an error state exists. Default
 * value is `undefined`.
 * @param {string} [props.textTestID] - Optional Maestro testID attached to the
 * rendered error text, useful for asserting the message content. Default value
 * is `undefined`.
 * @returns {React.JSX.Element} A shared error card with consistent failure
 * styling.
 */
export function ErrorBlock({ message, testID, textTestID }: ErrorBlockProps) {
  return (
    <View style={sharedStyles.errorContainer} testID={testID}>
      <Text style={sharedStyles.errorText} testID={textTestID}>
        Error: {message}
      </Text>
    </View>
  );
}
