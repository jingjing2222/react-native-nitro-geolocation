import React from "react";
import { Button, View } from "react-native";
import type { ButtonProps, StyleProp, ViewStyle } from "react-native";
import { sharedStyles } from "../styles";

/**
 * Props for `ScenarioButton`.
 *
 * @example
 * ```tsx
 * const props: ScenarioButtonProps = {
 *   title: "Run Scenario",
 *   onPress: runScenario,
 *   testID: "heading-run-current-button"
 * };
 * ```
 */
export type ScenarioButtonProps = {
  /** Button label shown to the user and used by text-based Maestro taps. */
  title: string;
  /** Async or sync callback that runs the scenario action. */
  onPress: NonNullable<ButtonProps["onPress"]>;
  /** Native button color. Defaults to the primary scenario blue. */
  color?: string;
  /** Disables the button while a scenario or request is already running. */
  disabled?: boolean;
  /** Stable Maestro testID for direct button taps. */
  testID?: string;
  /** Optional style override for the wrapper view. */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Props for `ButtonRow`.
 *
 * @example
 * ```tsx
 * const props: ButtonRowProps = {
 *   children: <ScenarioButton title="Run" onPress={runScenario} />
 * };
 * ```
 */
export type ButtonRowProps = {
  /** Row children, typically two `ScenarioButton` instances. */
  children: React.ReactNode;
};

/**
 * Props for `ButtonSlot`.
 *
 * @example
 * ```tsx
 * const props: ButtonSlotProps = {
 *   children: <Text>Custom control</Text>
 * };
 * ```
 */
export type ButtonSlotProps = {
  /** Custom row content that should occupy one flex slot. */
  children: React.ReactNode;
};

/**
 * Standard button wrapper for E2E actions.
 *
 * Prefer explicit `testID` values for buttons that Maestro taps. Use
 * `containerStyle={sharedStyles.button}` when placing buttons in `ButtonRow`.
 *
 * @example
 * ```tsx
 * <ScenarioButton
 *   title="Run Fine Permission Gate"
 *   onPress={runFineDeniedScenario}
 *   color="#7B1FA2"
 *   testID="android-request-options-run-fine-denied-button"
 * />
 * ```
 *
 * @param {ScenarioButtonProps} props - The props object passed to the
 * `ScenarioButton` component.
 * @param {string} props.title - Native button label shown to the user. Maestro
 * can also tap by this text when a direct `testID` is not used.
 * @param {NonNullable<ButtonProps["onPress"]>} props.onPress - Async or sync
 * scenario action called when the native button is pressed.
 * @param {string} [props.color = '#1976D2'] - React Native button color. The
 * default is the shared primary scenario blue.
 * @param {boolean} [props.disabled] - Whether the native button is disabled,
 * typically while a scenario is already running. Default value is `undefined`.
 * @param {string} [props.testID] - Stable Maestro testID attached to the native
 * `Button`, such as `heading-run-current-button`. Default value is `undefined`.
 * @param {StyleProp<ViewStyle>} [props.containerStyle] - Optional style merged
 * onto the wrapper `View`; pass `sharedStyles.button` when the button is inside
 * `ButtonRow`. Default value is `undefined`.
 * @returns {React.JSX.Element} A native `Button` wrapped with the shared button
 * spacing.
 */
export function ScenarioButton({
  title,
  onPress,
  color = "#1976D2",
  disabled,
  testID,
  containerStyle
}: ScenarioButtonProps) {
  return (
    <View style={[sharedStyles.buttonContainer, containerStyle]}>
      <Button
        title={title}
        onPress={onPress}
        color={color}
        disabled={disabled}
        testID={testID}
      />
    </View>
  );
}

/**
 * Horizontal row for two related `ScenarioButton` controls.
 *
 * @example
 * ```tsx
 * <ButtonRow>
 *   <ScenarioButton
 *     title="Start Watching"
 *     onPress={startWatching}
 *     containerStyle={sharedStyles.button}
 *   />
 *   <ScenarioButton
 *     title="Stop Watching"
 *     onPress={stopWatching}
 *     containerStyle={sharedStyles.button}
 *   />
 * </ButtonRow>
 * ```
 *
 * @param {ButtonRowProps} props - The props object passed to the `ButtonRow`
 * component.
 * @param {React.ReactNode} props.children - Row content, normally two
 * `ScenarioButton` components whose wrappers use `sharedStyles.button`.
 * @returns {React.JSX.Element} A horizontal row that spaces related controls
 * consistently.
 */
export function ButtonRow({ children }: ButtonRowProps) {
  return <View style={sharedStyles.buttonRow}>{children}</View>;
}

/**
 * Flex slot for custom controls inside a `ButtonRow`.
 *
 * Most screens should pass `containerStyle={sharedStyles.button}` directly to
 * `ScenarioButton`; use this slot only when the row child is not a button.
 *
 * @example
 * ```tsx
 * <ButtonRow>
 *   <ButtonSlot>
 *     <Text>Custom row control</Text>
 *   </ButtonSlot>
 * </ButtonRow>
 * ```
 *
 * @param {ButtonSlotProps} props - The props object passed to the `ButtonSlot`
 * component.
 * @param {React.ReactNode} props.children - Custom control or label that should
 * occupy one `sharedStyles.button` flex slot inside `ButtonRow`.
 * @returns {React.JSX.Element} A flex slot for non-button content in a
 * `ButtonRow`.
 */
export function ButtonSlot({ children }: ButtonSlotProps) {
  return <View style={sharedStyles.button}>{children}</View>;
}
