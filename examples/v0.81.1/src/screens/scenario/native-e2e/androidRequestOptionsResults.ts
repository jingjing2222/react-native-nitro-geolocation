import type { SetScenarioResult } from "../hooks/useScenarioResults";
import type { ScenarioResult } from "../types";
import { createScenarioResults } from "../utils/results";

export const androidRequestOptionsResults = createScenarioResults([
  "autoProvider",
  "playServicesProvider",
  "platformProvider",
  "fused",
  "oneShotDistance",
  "coarseCache",
  "mixedWatch",
  "maxUpdates",
  "headingUnwatch",
  "invalid",
  "fineDenied"
] as const);

export type AndroidRequestOptionsResultKey =
  keyof typeof androidRequestOptionsResults;

export type AndroidRequestOptionsSetResult = SetScenarioResult<
  Record<AndroidRequestOptionsResultKey, ScenarioResult>
>;
