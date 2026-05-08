import React from "react";
import { Text, View } from "react-native";
import { sharedStyles } from "../styles";
import type { ScenarioResult } from "../types";
import { createE2EId } from "../utils/e2eIds";

/**
 * Props for `ResultBlock`.
 *
 * @example
 * ```tsx
 * const props: ResultBlockProps = {
 *   prefix: "heading",
 *   id: "current",
 *   label: "Single heading",
 *   result: results.current
 * };
 * ```
 */
export type ResultBlockProps = {
  /** Optional scenario prefix used to build `${prefix}-${id}-*` testIDs. */
  prefix?: string;
  /** Scenario result id used as the base testID segment. */
  id: string;
  /** User-visible label rendered before the status. */
  label: string;
  /** Current scenario result state to display. */
  result: ScenarioResult;
};

/**
 * Descriptor for one `ResultBlock` rendered by `ResultList`.
 *
 * @example
 * ```ts
 * const item: ResultListItem<typeof results> = {
 *   id: "one-shot-distance",
 *   resultKey: "oneShotDistance",
 *   label: "One-shot distance"
 * };
 * ```
 */
export type ResultListItem<TResults extends Record<string, ScenarioResult>> = {
  /** TestID segment used for the rendered `ResultBlock`. */
  id: string;
  /** User-visible label rendered before the status. */
  label: string;
  /** Optional state key when it differs from the kebab-case rendered id. */
  resultKey?: keyof TResults;
};

/**
 * Props for `ResultList`.
 *
 * @example
 * ```tsx
 * const props: ResultListProps<typeof results> = {
 *   prefix: "android-request-options",
 *   results,
 *   items: [{ id: "permission", label: "Permission" }]
 * };
 * ```
 */
export type ResultListProps<TResults extends Record<string, ScenarioResult>> = {
  /** Scenario prefix used to build every rendered result testID. */
  prefix: string;
  /** Result state record owned by the screen. */
  results: TResults;
  /** Ordered result blocks to render. */
  items: Array<ResultListItem<TResults>>;
};

/**
 * Standard result card for a single contract scenario.
 *
 * With a prefix, the component renders `${prefix}-${id}-result`,
 * `${prefix}-${id}-status`, and `${prefix}-${id}-message`. Keep those ids
 * stable because Maestro flows assert them directly.
 *
 * @example
 * ```tsx
 * <ResultBlock
 *   prefix="heading"
 *   id="current"
 *   label="Single heading"
 *   result={results.current}
 * />
 * ```
 *
 * @param {ResultBlockProps} props - The props object passed to the
 * `ResultBlock` component.
 * @param {string} [props.prefix] - Optional scenario prefix used to generate
 * `${prefix}-${id}-result`, `${prefix}-${id}-status`, and
 * `${prefix}-${id}-message`. When omitted, `props.id` is used as the full base
 * testID.
 * @param {string} props.id - Scenario result id used as the rendered testID
 * segment, such as `current`, `watch`, or `one-shot-distance`.
 * @param {string} props.label - User-visible label rendered before the result
 * status.
 * @param {ScenarioResult} props.result - Current result state for this
 * scenario.
 * @param {ScenarioStatus} props.result.status - Lifecycle status rendered in
 * the status row and used to choose passed/failed styling.
 * @param {string} props.result.message - User-visible result detail rendered in
 * the message row.
 * @returns {React.JSX.Element} A result card with stable status and message
 * testIDs.
 */
export function ResultBlock({ prefix, id, label, result }: ResultBlockProps) {
  const baseId = prefix ? createE2EId(prefix, id) : id;

  return (
    <View
      style={[
        sharedStyles.resultContainer,
        result.status === "passed" && sharedStyles.resultPassed,
        result.status === "failed" && sharedStyles.resultFailed
      ]}
      testID={`${baseId}-result`}
    >
      <Text style={sharedStyles.resultStatus} testID={`${baseId}-status`}>
        {label}: {result.status}
      </Text>
      <Text style={sharedStyles.resultMessage} testID={`${baseId}-message`}>
        {result.message}
      </Text>
    </View>
  );
}

/**
 * Convenience renderer for a sequence of `ResultBlock` components.
 *
 * Use `resultKey` when the E2E testID uses kebab-case but the state key uses
 * camelCase.
 *
 * @example
 * ```tsx
 * <ResultList
 *   prefix="android-request-options"
 *   results={results}
 *   items={[
 *     {
 *       id: "one-shot-distance",
 *       resultKey: "oneShotDistance",
 *       label: "One-shot distance"
 *     }
 *   ]}
 * />
 * ```
 *
 * @param {ResultListProps<TResults>} props - The props object passed to the
 * `ResultList` component.
 * @param {string} props.prefix - Scenario prefix applied to every rendered
 * `ResultBlock` testID.
 * @param {TResults} props.results - Typed result record owned by the screen,
 * usually returned by `useScenarioResults`.
 * @param {Array<ResultListItem<TResults>>} props.items - Ordered descriptors
 * that decide which result blocks are rendered and how they are labeled.
 * @param {string} props.items[].id - Kebab-case testID segment for the rendered
 * result block.
 * @param {string} props.items[].label - User-visible label passed to
 * `ResultBlock`.
 * @param {keyof TResults} [props.items[].resultKey] - Optional state key when
 * the testID segment differs from the result record key, for example
 * `id="one-shot-distance"` with `resultKey="oneShotDistance"`.
 * @returns {React.JSX.Element} A fragment containing one `ResultBlock` per
 * descriptor in `props.items`.
 */
export function ResultList<TResults extends Record<string, ScenarioResult>>({
  prefix,
  results,
  items
}: ResultListProps<TResults>) {
  return (
    <>
      {items.map((item) => {
        const resultKey = (item.resultKey ?? item.id) as keyof TResults;

        return (
          <ResultBlock
            key={item.id}
            prefix={prefix}
            id={item.id}
            label={item.label}
            result={results[resultKey]}
          />
        );
      })}
    </>
  );
}
