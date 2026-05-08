/**
 * Public Scenario UI DSL for native E2E contract screens.
 *
 * Import from this barrel in screens instead of reaching into nested folders.
 *
 * @example
 * ```ts
 * import {
 *   ScenarioScreen,
 *   ScenarioSection,
 *   ScenarioButton,
 *   ResultBlock
 * } from "./scenario";
 * ```
 */
export * from "./components/ErrorBlock";
export * from "./components/KeyValueBlock";
export * from "./components/PositionInfo";
export * from "./components/ResultBlock";
export * from "./components/ScenarioButton";
export * from "./components/ScenarioMessageList";
export * from "./components/ScenarioScreen";
export * from "./components/ScenarioSection";
export * from "./components/StatusBlock";
export * from "./hooks/usePermissionStatus";
export * from "./hooks/useScenarioResults";
export * from "./styles";
export * from "./types";
export * from "./utils/e2eIds";
export * from "./utils/locationAssertions";
export * from "./utils/locationErrors";
export * from "./utils/nativeGeolocation";
export * from "./utils/results";
