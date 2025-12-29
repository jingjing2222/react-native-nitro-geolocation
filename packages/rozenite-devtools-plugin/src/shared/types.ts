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

export interface GeolocationPluginEvents extends Record<string, unknown> {
  position: Position;
}
