import { getCurrentPosition } from "react-native-nitro-geolocation";

export async function runPreAbortedCurrentPosition() {
  const controller = new AbortController();
  const reason = new Error("web pre-aborted request");
  controller.abort(reason);

  try {
    await getCurrentPosition({ signal: controller.signal });
    throw new Error("Pre-aborted request unexpectedly resolved.");
  } catch (error) {
    if (error !== reason) {
      throw new Error("Pre-aborted request did not preserve signal.reason.");
    }
    return { sameReason: true };
  }
}

export async function runCancelledCurrentPosition() {
  const controller = new AbortController();
  const reason = new Error("web in-flight cancellation");
  const request = getCurrentPosition({
    maximumAge: 0,
    signal: controller.signal,
    timeout: 15000
  });
  controller.abort(reason);

  try {
    await request;
    throw new Error("Cancelled request unexpectedly resolved.");
  } catch (error) {
    if (error !== reason) {
      throw new Error("In-flight request did not preserve signal.reason.");
    }
    return { sameReason: true };
  }
}
