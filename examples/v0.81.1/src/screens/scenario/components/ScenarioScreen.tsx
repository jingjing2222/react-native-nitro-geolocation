import React from "react";
import { ScrollView, Text, View } from "react-native";
import type { ScrollViewProps } from "react-native";
import { sharedStyles } from "../styles";
import { createE2EId } from "../utils/e2eIds";

/**
 * Props for `ScenarioScreen`.
 *
 * @example
 * ```tsx
 * const props: ScenarioScreenProps = {
 *   prefix: "heading",
 *   title: "Heading",
 *   subtitle: "Compass-style heading contract",
 *   children: null
 * };
 * ```
 */
export type ScenarioScreenProps = ScrollViewProps & {
  /** Prefix used to build the default screen testID: `${prefix}-screen`. */
  prefix: string;
  /** Human-readable screen title shown in the shared header. */
  title: string;
  /** Optional short contract summary shown below the title. */
  subtitle?: string;
  /** Numbered `ScenarioSection` nodes and any other screen content. */
  children: React.ReactNode;
};

/**
 * Top-level shell for one E2E contract screen.
 *
 * It owns the `ScrollView`, common header, and stable screen testID. Use this
 * as the root element for screens under `src/screens`.
 *
 * @example
 * ```tsx
 * <ScenarioScreen
 *   prefix="heading"
 *   title="Heading"
 *   subtitle="Compass-style heading contract"
 * >
 *   <ScenarioSection index={1} title="Permission">
 *     <PermissionStatusBlock prefix="heading" status={permissionStatus} />
 *   </ScenarioSection>
 * </ScenarioScreen>
 * ```
 *
 * @param {ScenarioScreenProps} props - The props object passed to the
 * `ScenarioScreen` component.
 * @param {string} props.prefix - Screen-level E2E prefix used to generate the
 * default container testID. For example, `prefix="heading"` renders
 * `testID="heading-screen"` unless `props.testID` is provided.
 * @param {string} props.title - Human-readable title rendered in the shared
 * header at the top of the screen.
 * @param {string} [props.subtitle] - Optional one-line contract summary
 * rendered below `props.title`. Default value is `undefined`.
 * @param {React.ReactNode} props.children - Scenario sections, status blocks,
 * buttons, result blocks, or custom E2E content rendered below the header.
 * @param {ScrollViewProps["contentContainerStyle"]} [props.contentContainerStyle]
 * - Optional React Native `ScrollView` content container style forwarded to the
 * root `ScrollView`. Default value is `undefined`.
 * @param {ScrollViewProps["testID"]} [props.testID] - Optional explicit testID
 * for the root `ScrollView`. Use this only to preserve an existing Maestro
 * contract; otherwise the default `${prefix}-screen` ID is used.
 * @param {ScrollViewProps["style"]} [props.style] - Optional style merged after
 * the shared screen container style. Default value is `undefined`.
 * @returns {React.JSX.Element} A full-screen `ScrollView` shell with the shared
 * E2E header and stable root testID.
 */
export function ScenarioScreen({
  prefix,
  title,
  subtitle,
  children,
  contentContainerStyle,
  testID,
  ...scrollViewProps
}: ScenarioScreenProps) {
  return (
    <ScrollView
      {...scrollViewProps}
      style={[sharedStyles.container, scrollViewProps.style]}
      contentContainerStyle={contentContainerStyle}
      testID={testID ?? createE2EId(prefix, "screen")}
    >
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>{title}</Text>
        {subtitle ? (
          <Text style={sharedStyles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}
