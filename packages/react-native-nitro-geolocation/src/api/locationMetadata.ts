import type {
  GeolocationResponse,
  LocationMetadata,
  LocationQualityBand,
  LocationResponseSource,
  LocationStaleReason
} from "../publicTypes";

export interface LocationMetadataContext {
  source: LocationResponseSource;
  maximumAge?: number;
  requestedAt?: number;
  observedAt?: number;
}

const TIMESTAMP_CLOCK_TOLERANCE_MS = 1;

function classifyAccuracy(accuracy: number): LocationQualityBand {
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    return "unknown";
  }
  if (accuracy <= 10) {
    return "high";
  }
  if (accuracy <= 100) {
    return "medium";
  }
  return "low";
}

function getStaleReason(
  timestamp: number,
  maximumAge: number | undefined,
  requestedAt: number,
  observedAt: number
): LocationStaleReason | undefined {
  if (!Number.isFinite(timestamp)) {
    return "invalidTimestamp";
  }
  if (timestamp - observedAt > TIMESTAMP_CLOCK_TOLERANCE_MS) {
    return "futureTimestamp";
  }
  if (
    maximumAge === undefined ||
    maximumAge === Number.POSITIVE_INFINITY ||
    !Number.isFinite(maximumAge) ||
    maximumAge < 0
  ) {
    return undefined;
  }

  if (maximumAge === 0) {
    return timestamp < requestedAt ? "maximumAgeExceeded" : undefined;
  }

  return Math.max(0, requestedAt - timestamp) >= maximumAge
    ? "maximumAgeExceeded"
    : undefined;
}

/** Add descriptive metadata without changing whether a position is accepted. */
export function decoratePositionWithMetadata(
  position: GeolocationResponse,
  context: LocationMetadataContext
): GeolocationResponse {
  const observedAt = context.observedAt ?? Date.now();
  const requestedAt = context.requestedAt ?? observedAt;
  const basePosition = { ...position };
  basePosition.metadata = undefined;
  const staleReason = getStaleReason(
    position.timestamp,
    context.maximumAge,
    requestedAt,
    observedAt
  );
  const metadata: LocationMetadata = {
    quality: classifyAccuracy(position.coords.accuracy),
    source: context.source
  };

  if (Number.isFinite(position.timestamp)) {
    metadata.age = Math.max(0, observedAt - position.timestamp);
  }
  if (staleReason) {
    metadata.staleReason = staleReason;
  }

  return { ...basePosition, metadata };
}
