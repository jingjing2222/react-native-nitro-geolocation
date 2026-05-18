import { runCompatSuite } from "./compatRunner";
import { render } from "./dom";
import {
  runDeniedCheck,
  runSuccessSuite,
  runTimeoutCheck,
  runUnavailableCheck
} from "./runner";
import { scenarios } from "./scenarios";
import "./styles.css";

const successButton = document.querySelector<HTMLButtonElement>("#run-success");
const compatButton = document.querySelector<HTMLButtonElement>("#run-compat");
const deniedButton = document.querySelector<HTMLButtonElement>("#run-denied");
const unavailableButton =
  document.querySelector<HTMLButtonElement>("#run-unavailable");
const timeoutButton = document.querySelector<HTMLButtonElement>("#run-timeout");
const clearButton = document.querySelector<HTMLButtonElement>("#clear-results");

successButton?.addEventListener("click", () => {
  void runSuccessSuite();
});
compatButton?.addEventListener("click", () => {
  void runCompatSuite();
});
deniedButton?.addEventListener("click", () => {
  void runDeniedCheck();
});
unavailableButton?.addEventListener("click", () => {
  void runUnavailableCheck();
});
timeoutButton?.addEventListener("click", () => {
  void runTimeoutCheck();
});
clearButton?.addEventListener("click", () => {
  for (const scenario of scenarios) {
    scenario.status =
      scenario.id === "position-unavailable" || scenario.id === "timeout"
        ? "manual"
        : "idle";
    scenario.raw = undefined;
  }
  render();
});

render();

const params = new URLSearchParams(location.search);
if (params.get("autorun") === "success") {
  void runSuccessSuite();
} else if (params.get("autorun") === "compat") {
  void runCompatSuite();
} else if (params.get("autorun") === "denied") {
  void runDeniedCheck();
} else if (params.get("autorun") === "unavailable") {
  void runUnavailableCheck();
} else if (params.get("autorun") === "timeout") {
  void runTimeoutCheck();
}
