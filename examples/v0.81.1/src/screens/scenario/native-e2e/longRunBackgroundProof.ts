import type {
  BackgroundEvent,
  StoredBackgroundEvent,
  StoredBackgroundLocation
} from "react-native-nitro-geolocation/background";

export const GEOFENCE_ID = "long-run-office";
export const GEOFENCE_CENTER = {
  latitude: 37.5665,
  longitude: 126.978
};
export const GEOFENCE_OUTSIDE = {
  latitude: 37.563,
  longitude: 126.97
};

export const eventType = (event: StoredBackgroundEvent) => event.event.type;

export const isDeliveredLocationEvent = (event: StoredBackgroundEvent) =>
  event.deliveredToJS && eventType(event) === "location";

export const isLocationEventMeasuredAtOrAfter = (
  event: StoredBackgroundEvent,
  proofAfter: number | undefined
) =>
  proofAfter !== undefined &&
  event.event.type === "location" &&
  event.event.location.timestamp >= proofAfter;

export const isCoordinate = (
  latitude: number,
  longitude: number,
  expected: { latitude: number; longitude: number }
) =>
  Math.abs(latitude - expected.latitude) < 0.000_1 &&
  Math.abs(longitude - expected.longitude) < 0.000_1;

export const isGeofenceTransition = (
  event: StoredBackgroundEvent,
  transition: "enter" | "exit"
) => {
  const backgroundEvent: BackgroundEvent = event.event;
  return (
    backgroundEvent.type === "geofence" &&
    backgroundEvent.geofence.transition === transition
  );
};

type TimedCoordinate = {
  timestamp: number;
  latitude: number;
  longitude: number;
};

const hasInsideThenOutside = (
  samples: TimedCoordinate[],
  proofAfter: number
) => {
  const insideAt = samples
    .filter(
      (sample) =>
        sample.timestamp >= proofAfter &&
        isCoordinate(sample.latitude, sample.longitude, GEOFENCE_CENTER)
    )
    .reduce(
      (earliest, sample) => Math.min(earliest, sample.timestamp),
      Number.POSITIVE_INFINITY
    );
  return samples.some(
    (sample) =>
      sample.timestamp > insideAt &&
      isCoordinate(sample.latitude, sample.longitude, GEOFENCE_OUTSIDE)
  );
};

const hasOutsideInsideOutside = (
  samples: TimedCoordinate[],
  proofAfter: number
) => {
  const firstOutsideAt = samples
    .filter(
      (sample) =>
        sample.timestamp >= proofAfter &&
        isCoordinate(sample.latitude, sample.longitude, GEOFENCE_OUTSIDE)
    )
    .reduce(
      (earliest, sample) => Math.min(earliest, sample.timestamp),
      Number.POSITIVE_INFINITY
    );
  const insideAt = samples
    .filter(
      (sample) =>
        sample.timestamp > firstOutsideAt &&
        isCoordinate(sample.latitude, sample.longitude, GEOFENCE_CENTER)
    )
    .reduce(
      (earliest, sample) => Math.min(earliest, sample.timestamp),
      Number.POSITIVE_INFINITY
    );
  return samples.some(
    (sample) =>
      sample.timestamp > insideAt &&
      isCoordinate(sample.latitude, sample.longitude, GEOFENCE_OUTSIDE)
  );
};

const locationCoordinates = (locations: StoredBackgroundLocation[]) =>
  locations.map((location) => ({
    timestamp: location.timestamp,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude
  }));

const eventLocationCoordinates = (events: StoredBackgroundEvent[]) =>
  events.flatMap((event) =>
    event.event.type === "location"
      ? [
          {
            timestamp: event.event.location.timestamp,
            latitude: event.event.location.coords.latitude,
            longitude: event.event.location.coords.longitude
          }
        ]
      : []
  );

export const hasOrderedBackgroundLocationProof = (
  locations: StoredBackgroundLocation[],
  events: StoredBackgroundEvent[],
  proofAfter: number | undefined
) =>
  proofAfter !== undefined &&
  hasInsideThenOutside(locationCoordinates(locations), proofAfter) &&
  hasInsideThenOutside(eventLocationCoordinates(events), proofAfter);

export const hasOrderedRebootLocationProof = (
  locations: StoredBackgroundLocation[],
  events: StoredBackgroundEvent[],
  proofAfter: number | undefined
) =>
  proofAfter !== undefined &&
  hasOutsideInsideOutside(locationCoordinates(locations), proofAfter) &&
  hasOutsideInsideOutside(eventLocationCoordinates(events), proofAfter);

export const hasOrderedGeofenceTransitionProof = (
  events: StoredBackgroundEvent[],
  proofAfter: number | undefined
) => {
  if (proofAfter === undefined) return false;
  const transitions = events.flatMap((event) =>
    event.event.type === "geofence" &&
    event.event.geofence.region.identifier === GEOFENCE_ID
      ? [event.event.geofence]
      : []
  );
  const enterAt = transitions
    .filter(
      (geofence) =>
        geofence.transition === "enter" && geofence.timestamp >= proofAfter
    )
    .reduce(
      (earliest, geofence) => Math.min(earliest, geofence.timestamp),
      Number.POSITIVE_INFINITY
    );
  return transitions.some(
    (geofence) => geofence.transition === "exit" && geofence.timestamp > enterAt
  );
};

export const isTimestampAtOrAfter = (value: string, marker: string) => {
  const timestamp = Number(value);
  const markerTimestamp = Number(marker);
  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(markerTimestamp) &&
    timestamp >= markerTimestamp
  );
};
