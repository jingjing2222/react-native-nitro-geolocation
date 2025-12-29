export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  altitudeAccuracy: number;
  heading: number;
  speed: number;
}

export interface GeolocationPluginEvents extends Record<string, unknown> {
  position: Position;
}

declare global {
  var __geolocationDevToolsEnabled: boolean | undefined;
}
