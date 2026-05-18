import { postNativeScenarioUpdate } from "./nativeBridge";
import { type ScenarioStatus, scenarios } from "./scenarios";

const grid = document.querySelector<HTMLDivElement>("#scenario-grid");

export function render() {
  if (!grid) {
    return;
  }

  grid.innerHTML = scenarios
    .map(
      (scenario) => `
        <article class="scenario ${scenario.status}" data-testid="${scenario.id}">
          <div>
            <span class="badge">${scenario.status.toUpperCase()}</span>
            <h2>${scenario.title}</h2>
            <p>${scenario.detail}</p>
          </div>
          <pre>${escapeHtml(JSON.stringify(scenario.raw ?? null, null, 2))}</pre>
        </article>
      `
    )
    .join("");
}

export function setScenario(
  id: string,
  status: ScenarioStatus,
  raw?: unknown,
  detail?: string
) {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) {
    return;
  }

  scenario.status = status;
  scenario.raw = raw;
  if (detail) {
    scenario.detail = detail;
  }
  render();
  postNativeScenarioUpdate({
    id,
    status,
    detail: scenario.detail,
    raw
  });
  if (status !== "idle") {
    document
      .querySelector(`[data-testid="${id}"]`)
      ?.scrollIntoView({ block: "center", behavior: "auto" });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
