export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface Position {
  coords: GeolocationCoordinates;
  timestamp: number;
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
