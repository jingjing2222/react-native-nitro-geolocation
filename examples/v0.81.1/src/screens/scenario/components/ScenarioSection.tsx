import React from "react";
import { Text, View } from "react-native";
import { sharedStyles } from "../styles";

/**
 * Props for `ScenarioSection`.
 *
 * @example
 * ```tsx
 * const props: ScenarioSectionProps = {
 *   index: 2,
 *   title: "Positive Scenario",
 *   divided: true,
 *   children: null
 * };
 * ```
 */
export type ScenarioSectionProps = {
  /** Optional 1-based section number rendered before the title. */
  index?: number;
  /** Section title describing the contract step. */
  title: string;
  /** Optional explanation of what this scenario section validates. */
  description?: string;
  /** Buttons, status blocks, result blocks, or custom contract content. */
  children: React.ReactNode;
  /** Whether to render the standard divider before this section. */
  divided?: boolean;
  /** Optional testID for the section container. */
  testID?: string;
};

/**
 * Numbered content section inside a `ScenarioScreen`.
 *
 * Set `divided` when the section should render the standard divider before
 * itself. Keep native contract logic in the screen and use this component only
 * for layout and readable section headings.
 *
 * @example
 * ```tsx
 * <ScenarioSection
 *   index={2}
 *   title="Positive Scenario"
 *   description="Runs the native request with a granted permission."
 *   divided
 * >
 *   <ScenarioButton title="Run" onPress={runPositiveScenario} />
 * </ScenarioSection>
 * ```
 *
 * @param {ScenarioSectionProps} props - The props object passed to the
 * `ScenarioSection` component.
 * @param {number} [props.index] - Optional 1-based section number rendered
 * before the title, such as `2. Positive Scenario`. Default value is
 * `undefined`, which renders the title without a numeric prefix.
 * @param {string} props.title - Section title that names the contract step or
 * scenario group.
 * @param {string} [props.description] - Optional explanatory text rendered
 * below the title and above the section body. Default value is `undefined`.
 * @param {React.ReactNode} props.children - Section body content, usually
 * `ScenarioButton`, `StatusBlock`, `PositionInfo`, `ResultBlock`, or
 * screen-local contract UI.
 * @param {boolean} [props.divided = false] - Whether to render the shared
 * divider above this section. Use it for every section after the first when the
 * screen needs visual separation.
 * @param {string} [props.testID] - Optional Maestro testID attached to the
 * section container. Default value is `undefined`.
 * @returns {React.JSX.Element} A section wrapper with optional divider,
 * heading, description, and children.
 */
export function ScenarioSection({
  index,
  title,
  description,
  children,
  divided = false,
  testID
}: ScenarioSectionProps) {
  return (
    <>
      {divided ? <View style={sharedStyles.divider} /> : null}
      <View style={sharedStyles.section} testID={testID}>
        <Text style={sharedStyles.sectionTitle}>
          {index == null ? title : `${index}. ${title}`}
        </Text>
        {description ? (
          <Text style={sharedStyles.description}>{description}</Text>
        ) : null}
        {children}
      </View>
    </>
  );
}
