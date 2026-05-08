import React from "react";
import { Text, View } from "react-native";
import { sharedStyles } from "../styles";

/**
 * One combined text row in a `KeyValueBlock`.
 *
 * @example
 * ```ts
 * const row: KeyValueBlockRow = {
 *   label: "Services",
 *   value: "enabled",
 *   testID: "provider-settings-services"
 * };
 * ```
 */
export type KeyValueBlockRow = {
  /** Static label rendered before the colon. */
  label: string;
  /** Dynamic value rendered after the colon in the same text node. */
  value: React.ReactNode;
  /** Optional Maestro testID attached to the combined row text node. */
  testID?: string;
};

/**
 * Props for `KeyValueBlock`.
 *
 * @example
 * ```tsx
 * const props: KeyValueBlockProps = {
 *   rows: [{ label: "Code", value: 1 }],
 *   testID: "api-error-card"
 * };
 * ```
 */
export type KeyValueBlockProps = {
  /** Ordered rows to render in the key-value card. */
  rows: KeyValueBlockRow[];
  /** Optional Maestro testID attached to the outer card. */
  testID?: string;
};

/**
 * Stacked key-value card where each row renders as one combined text node.
 *
 * Use this when Maestro must match text such as `Services: enabled` or
 * `Code: 1`. For value-only assertions, prefer `StatusBlock`.
 *
 * @example
 * ```tsx
 * <KeyValueBlock
 *   testID="provider-settings-status"
 *   rows={[
 *     {
 *       label: "Services",
 *       value: "enabled",
 *       testID: "provider-settings-services"
 *     },
 *     {
 *       label: "GPS",
 *       value: "enabled",
 *       testID: "provider-settings-gps"
 *     }
 *   ]}
 * />
 * ```
 *
 * @param {KeyValueBlockProps} props - The props object passed to the
 * `KeyValueBlock` component.
 * @param {KeyValueBlockRow[]} props.rows - Ordered key-value rows rendered from
 * top to bottom in the card.
 * @param {string} props.rows[].label - Static key rendered before `:`, such as
 * `Services`, `GPS`, or `Code`.
 * @param {React.ReactNode} props.rows[].value - Dynamic value rendered after
 * the colon in the same text node as the key.
 * @param {string} [props.rows[].testID] - Optional Maestro testID attached to
 * the combined key-value row. Default value is `undefined`.
 * @param {string} [props.testID] - Optional Maestro testID attached to the
 * outer key-value card. Default value is `undefined`.
 * @returns {React.JSX.Element} A stacked card where each row exposes one
 * combined `Label: value` text node.
 */
export function KeyValueBlock({ rows, testID }: KeyValueBlockProps) {
  return (
    <View style={sharedStyles.statusStackContainer} testID={testID}>
      {rows.map((row, index) => (
        <Text
          key={`${row.label}-${index}`}
          style={[
            sharedStyles.positionText,
            index < rows.length - 1 && sharedStyles.statusStackRow
          ]}
          testID={row.testID}
        >
          <Text style={sharedStyles.statusLabel}>{row.label}: </Text>
          <Text style={sharedStyles.statusValue}>{row.value}</Text>
        </Text>
      ))}
    </View>
  );
}
