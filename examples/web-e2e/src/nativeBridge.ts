import type { ScenarioStatus } from "./scenarios";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

export function postNativeScenarioUpdate({
  id,
  status,
  detail,
  raw
}: {
  id: string;
  status: ScenarioStatus;
  detail: string;
  raw?: unknown;
}) {
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({
      id,
      status,
      detail,
      raw
    })
  );
}

export function postNativeStatus(
  id: string,
  status: ScenarioStatus,
  raw?: unknown
) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ id, status, raw }));
}
