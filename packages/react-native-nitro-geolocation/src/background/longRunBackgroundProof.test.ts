import { describe, expect, it } from "vitest";
import {
  GEOFENCE_CENTER,
  GEOFENCE_ID,
  GEOFENCE_OUTSIDE,
  hasOrderedBackgroundLocationProof,
  hasOrderedGeofenceTransitionProof,
  hasOrderedRebootLocationProof,
  isLocationEventMeasuredAtOrAfter
} from "../../../../examples/v0.81.1/src/screens/scenario/native-e2e/longRunBackgroundProof";

const location = (
  timestamp: number,
  createdAt: number,
  coordinate: typeof GEOFENCE_CENTER
) =>
  ({
    timestamp,
    createdAt,
    coords: coordinate
  }) as never;

const locationEvent = (
  timestamp: number,
  createdAt: number,
  coordinate: typeof GEOFENCE_CENTER
) =>
  ({
    createdAt,
    event: {
      type: "location",
      location: location(timestamp, createdAt, coordinate)
    }
  }) as never;

const geofenceEvent = (
  transition: "enter" | "exit",
  timestamp: number,
  identifier = GEOFENCE_ID
) =>
  ({
    createdAt: timestamp,
    event: {
      type: "geofence",
      geofence: { transition, timestamp, region: { identifier } }
    }
  }) as never;

describe("long-run background proof", () => {
  it("orders measurements even when receipt timestamps are equal", () => {
    const locations = [
      location(1_010, 2_000, GEOFENCE_CENTER),
      location(1_020, 2_000, GEOFENCE_OUTSIDE)
    ];
    const events = [
      locationEvent(1_010, 2_000, GEOFENCE_CENTER),
      locationEvent(1_020, 2_000, GEOFENCE_OUTSIDE)
    ];

    expect(hasOrderedBackgroundLocationProof(locations, events, 1_000)).toBe(
      true
    );
  });

  it("rejects pre-marker measurements received after the marker", () => {
    const locations = [
      location(990, 2_000, GEOFENCE_CENTER),
      location(1_020, 2_010, GEOFENCE_OUTSIDE)
    ];
    const events = [
      locationEvent(990, 2_000, GEOFENCE_CENTER),
      locationEvent(1_020, 2_010, GEOFENCE_OUTSIDE)
    ];

    expect(hasOrderedBackgroundLocationProof(locations, events, 1_000)).toBe(
      false
    );
  });

  it("rejects outside-to-inside measurement order", () => {
    const locations = [
      location(1_010, 1_010, GEOFENCE_OUTSIDE),
      location(1_020, 1_020, GEOFENCE_CENTER)
    ];
    const events = [
      locationEvent(1_010, 1_010, GEOFENCE_OUTSIDE),
      locationEvent(1_020, 1_020, GEOFENCE_CENTER)
    ];

    expect(hasOrderedBackgroundLocationProof(locations, events, 1_000)).toBe(
      false
    );
  });

  it("requires outside, inside, and outside measurements after reboot", () => {
    const locations = [
      location(1_010, 1_010, GEOFENCE_OUTSIDE),
      location(1_020, 1_020, GEOFENCE_CENTER),
      location(1_030, 1_030, GEOFENCE_OUTSIDE)
    ];
    const events = [
      locationEvent(1_010, 1_010, GEOFENCE_OUTSIDE),
      locationEvent(1_020, 1_020, GEOFENCE_CENTER),
      locationEvent(1_030, 1_030, GEOFENCE_OUTSIDE)
    ];

    expect(hasOrderedRebootLocationProof(locations, events, 1_000)).toBe(true);
  });

  it("rejects reboot proof without the first outside measurement", () => {
    const incompleteLocations = [
      location(1_020, 1_020, GEOFENCE_CENTER),
      location(1_030, 1_030, GEOFENCE_OUTSIDE)
    ];
    const incompleteEvents = [
      locationEvent(1_020, 1_020, GEOFENCE_CENTER),
      locationEvent(1_030, 1_030, GEOFENCE_OUTSIDE)
    ];
    const completeLocations = [
      location(1_010, 1_010, GEOFENCE_OUTSIDE),
      ...incompleteLocations
    ];
    const completeEvents = [
      locationEvent(1_010, 1_010, GEOFENCE_OUTSIDE),
      ...incompleteEvents
    ];

    expect(
      hasOrderedRebootLocationProof(completeLocations, incompleteEvents, 1_000)
    ).toBe(false);
    expect(
      hasOrderedRebootLocationProof(incompleteLocations, completeEvents, 1_000)
    ).toBe(false);
  });

  it("rejects reboot proof when the first outside measurement is late", () => {
    const locations = [
      location(1_010, 1_010, GEOFENCE_CENTER),
      location(1_020, 1_020, GEOFENCE_OUTSIDE),
      location(1_030, 1_030, GEOFENCE_OUTSIDE)
    ];
    const events = [
      locationEvent(1_010, 1_010, GEOFENCE_CENTER),
      locationEvent(1_020, 1_020, GEOFENCE_OUTSIDE),
      locationEvent(1_030, 1_030, GEOFENCE_OUTSIDE)
    ];

    expect(hasOrderedRebootLocationProof(locations, events, 1_000)).toBe(false);
  });

  it("rejects a delivered event measured before its proof marker", () => {
    const event = {
      ...locationEvent(990, 2_000, GEOFENCE_CENTER),
      deliveredToJS: true
    } as never;

    expect(isLocationEventMeasuredAtOrAfter(event, 1_000)).toBe(false);
    expect(
      isLocationEventMeasuredAtOrAfter(
        {
          ...locationEvent(1_010, 2_000, GEOFENCE_CENTER),
          deliveredToJS: true
        } as never,
        1_000
      )
    ).toBe(true);
  });

  it("requires the target geofence to enter before it exits", () => {
    expect(
      hasOrderedGeofenceTransitionProof(
        [geofenceEvent("exit", 1_010), geofenceEvent("enter", 1_020)],
        1_000
      )
    ).toBe(false);
    expect(
      hasOrderedGeofenceTransitionProof(
        [
          geofenceEvent("enter", 1_010, "other"),
          geofenceEvent("enter", 1_020),
          geofenceEvent("exit", 1_030)
        ],
        1_000
      )
    ).toBe(true);
  });
});
