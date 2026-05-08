import React from "react";
import { Text, View } from "react-native";
import { sharedStyles } from "../styles";
import { createE2EId } from "../utils/e2eIds";

/**
 * One row in a `StatusBlock`.
 *
 * @example
 * ```ts
 * const row: StatusBlockRow = {
 *   label: "Watch count:",
 *   value: 3,
 *   testID: "watch-count"
 * };
 * ```
 */
export type StatusBlockRow = {
  /** Static label rendered in the left column, including punctuation if wanted. */
  label: string;
  /** Dynamic value rendered in the right column. */
  value: React.ReactNode;
  /** Optional Maestro testID attached to the value text node. */
  testID?: string;
};

/**
 * Props for `StatusBlock`.
 *
 * @example
 * ```tsx
 * const props: StatusBlockProps = {
 *   rows: [{ label: "Permission:", value: "granted" }],
 *   testID: "permission-card"
 * };
 * ```
 */
export type StatusBlockProps = {
  /** Ordered rows to render in the status card. */
  rows: StatusBlockRow[];
  /** Optional Maestro testID attached to the outer card. */
  testID?: string;
};

/**
 * Props for `PermissionStatusBlock`.
 *
 * @example
 * ```tsx
 * const props: PermissionStatusBlockProps = {
 *   prefix: "heading",
 *   status: "granted"
 * };
 * ```
 */
export type PermissionStatusBlockProps = {
  /** Scenario prefix used to build the default `${prefix}-permission` testID. */
  prefix: string;
  /** Current permission value shown to the user. */
  status: string;
  /** Optional label override. Defaults to `Permission:`. */
  label?: string;
  /** Optional explicit value testID when a legacy Maestro flow requires it. */
  testID?: string;
};

/**
 * Stacked status card where the label and value are separate text nodes.
 *
 * Use this when Maestro targets the value by testID or the value is dynamic
 * but does not need to be matched as one combined string.
 *
 * @example
 * ```tsx
 * <StatusBlock
 *   rows={[
 *     {
 *       label: "Status:",
 *       value: isWatching ? "Watching" : "Not Watching",
 *       testID: "watch-status"
 *     }
 *   ]}
 * />
 * ```
 *
 * @param {StatusBlockProps} props - The props object passed to the
 * `StatusBlock` component.
 * @param {StatusBlockRow[]} props.rows - Ordered status rows rendered from top
 * to bottom in the card.
 * @param {string} props.rows[].label - Static label rendered before the value,
 * including punctuation if the screen wants `Permission:` or `Status:`.
 * @param {React.ReactNode} props.rows[].value - Dynamic status value rendered
 * in a separate text node so Maestro can target it independently.
 * @param {string} [props.rows[].testID] - Optional Maestro testID attached to
 * the value text node. Default value is `undefined`.
 * @param {string} [props.testID] - Optional Maestro testID attached to the
 * outer status card. Default value is `undefined`.
 * @returns {React.JSX.Element} A stacked status card with separate label and
 * value text nodes for each row.
 */
export function StatusBlock({ rows, testID }: StatusBlockProps) {
  return (
    <View style={sharedStyles.statusStackContainer} testID={testID}>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[
            sharedStyles.statusStackRow,
            index === rows.length - 1 && sharedStyles.statusStackRowLast
          ]}
        >
          <Text style={sharedStyles.statusLabel}>{row.label}</Text>
          <Text style={sharedStyles.statusValue} testID={row.testID}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Standard one-row permission status card.
 *
 * The value testID defaults to `${prefix}-permission`, matching the scenario
 * screen testID convention.
 *
 * @example
 * ```tsx
 * <PermissionStatusBlock
 *   prefix="location-availability"
 *   status={permissionStatus}
 * />
 * ```
 *
 * @param {PermissionStatusBlockProps} props - The props object passed to the
 * `PermissionStatusBlock` component.
 * @param {string} props.prefix - Scenario prefix used to generate the default
 * value testID. For example, `prefix="heading"` renders
 * `testID="heading-permission"` unless `props.testID` is provided.
 * @param {string} props.status - Permission status string shown in the card,
 * such as `unknown`, `granted`, or a platform-specific denied value.
 * @param {string} [props.label = 'Permission:'] - Label rendered before the
 * status value. Override it only when a screen needs different wording.
 * @param {string} [props.testID] - Optional explicit Maestro testID for the
 * status value. Use this to preserve an existing flow when it does not follow
 * the `${prefix}-permission` convention.
 * @returns {React.JSX.Element} A one-row `StatusBlock` for permission state.
 */
export function PermissionStatusBlock({
  prefix,
  status,
  label = "Permission:",
  testID
}: PermissionStatusBlockProps) {
  return (
    <StatusBlock
      rows={[
        {
          label,
          value: status,
          testID: testID ?? createE2EId(prefix, "permission")
        }
      ]}
    />
  );
}
