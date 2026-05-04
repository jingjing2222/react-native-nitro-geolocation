export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export type LocationProviderUsed =
  | "fused"
  | "gps"
  | "network"
  | "passive"
  | "unknown";

export interface Position {
  coords: GeolocationCoordinates;
  timestamp: number;
  mocked?: boolean;
  provider?: LocationProviderUsed;
}

// UI receives these messages from RN
export interface DevtoolsUIEvents extends Record<string, unknown> {
  initialPosition: Position;
}

// RN receives these messages from UI
export interface DevtoolsRNEvents extends Record<string, unknown> {
  ready: null;
  position: Position;
}
