import React from "react";
import { Text, View } from "react-native";
import { sharedStyles } from "../styles";
import { createE2EId } from "../utils/e2eIds";

/**
 * Detail message for one sub-scenario in `ScenarioMessageList`.
 *
 * @example
 * ```ts
 * const message: ScenarioMessage = {
 *   id: "android-balanced",
 *   title: "Android balanced accuracy",
 *   message: "Resolved within the fixture tolerance."
 * };
 * ```
 */
export type ScenarioMessage = {
  /** Stable React key for the message item. */
  id: string;
  /** User-visible sub-scenario title. */
  title: string;
  /** User-visible sub-scenario detail or assertion summary. */
  message: string;
};

/**
 * Props for `ScenarioMessageList`.
 *
 * @example
 * ```tsx
 * const props: ScenarioMessageListProps = {
 *   prefix: "accuracy-presets",
 *   messages
 * };
 * ```
 */
export type ScenarioMessageListProps = {
  /** Scenario prefix used to build default per-message testIDs. */
  prefix: string;
  /** Ordered messages to render after an aggregate scenario. */
  messages: ScenarioMessage[];
  /** Base testID segment. Defaults to `scenario`. */
  id?: string;
};

/**
 * Renders detailed per-case messages after an aggregate scenario passes.
 *
 * It is useful when one button executes several platform-specific cases but
 * Maestro still needs stable ids for each sub-result. The default ids are
 * `${prefix}-scenario-${index}`, `${prefix}-scenario-${index}-title`, and
 * `${prefix}-scenario-${index}-message`.
 *
 * @example
 * ```tsx
 * <ScenarioMessageList
 *   prefix="accuracy-presets"
 *   messages={[
 *     {
 *       id: "android-high-overrides-false",
 *       title: "Android high overrides enableHighAccuracy=false",
 *       message: "contract passed with injected location 37.566500, 126.978000"
 *     }
 *   ]}
 * />
 * ```
 *
 * @param {ScenarioMessageListProps} props - The props object passed to the
 * `ScenarioMessageList` component.
 * @param {string} props.prefix - Scenario prefix used to build each detail
 * message testID.
 * @param {ScenarioMessage[]} props.messages - Ordered sub-scenario messages
 * rendered after an aggregate scenario result.
 * @param {string} props.messages[].id - Stable React key for the message item.
 * This value is not used in the default Maestro testID; the rendered index is
 * used instead so existing flows can assert deterministic order.
 * @param {string} props.messages[].title - User-visible title for the
 * sub-scenario.
 * @param {string} props.messages[].message - User-visible assertion detail or
 * native result summary for the sub-scenario.
 * @param {string} [props.id = 'scenario'] - Base testID segment. With the
 * default value, rendered IDs are `${prefix}-scenario-${index}`,
 * `${prefix}-scenario-${index}-title`, and
 * `${prefix}-scenario-${index}-message`.
 * @returns {React.JSX.Element} A fragment containing one detail message card
 * per item in `props.messages`.
 */
export function ScenarioMessageList({
  prefix,
  messages,
  id = "scenario"
}: ScenarioMessageListProps) {
  return (
    <>
      {messages.map((scenario, index) => (
        <View
          key={scenario.id}
          style={sharedStyles.scenarioContainer}
          testID={createE2EId(prefix, id, index)}
        >
          <Text
            style={sharedStyles.scenarioTitle}
            testID={createE2EId(prefix, id, index, "title")}
          >
            {scenario.title}
          </Text>
          <Text
            style={sharedStyles.scenarioText}
            testID={createE2EId(prefix, id, index, "message")}
          >
            {scenario.message}
          </Text>
        </View>
      ))}
    </>
  );
}
