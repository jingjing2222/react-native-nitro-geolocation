import type { Position } from "./types";

export interface LocationPreset {
  name: string;
  city: string;
  country: string;
  coords: {
    latitude: number;
    longitude: number;
  };
}

export const LOCATION_PRESETS = [
  {
    name: "Seoul, South Korea",
    city: "Seoul",
    country: "South Korea",
    coords: { latitude: 37.5665, longitude: 126.978 }
  },
  {
    name: "Tokyo, Japan",
    city: "Tokyo",
    country: "Japan",
    coords: { latitude: 35.6762, longitude: 139.6503 }
  },
  {
    name: "New York, USA",
    city: "New York",
    country: "USA",
    coords: { latitude: 40.7128, longitude: -74.006 }
  },
  {
    name: "Los Angeles, USA",
    city: "Los Angeles",
    country: "USA",
    coords: { latitude: 34.0522, longitude: -118.2437 }
  },
  {
    name: "San Francisco, USA",
    city: "San Francisco",
    country: "USA",
    coords: { latitude: 37.7749, longitude: -122.4194 }
  },
  {
    name: "London, UK",
    city: "London",
    country: "UK",
    coords: { latitude: 51.5074, longitude: -0.1278 }
  },
  {
    name: "Paris, France",
    city: "Paris",
    country: "France",
    coords: { latitude: 48.8566, longitude: 2.3522 }
  },
  {
    name: "Berlin, Germany",
    city: "Berlin",
    country: "Germany",
    coords: { latitude: 52.52, longitude: 13.405 }
  },
  {
    name: "Sydney, Australia",
    city: "Sydney",
    country: "Australia",
    coords: { latitude: -33.8688, longitude: 151.2093 }
  },
  {
    name: "Singapore",
    city: "Singapore",
    country: "Singapore",
    coords: { latitude: 1.3521, longitude: 103.8198 }
  },
  {
    name: "Hong Kong",
    city: "Hong Kong",
    country: "Hong Kong",
    coords: { latitude: 22.3193, longitude: 114.1694 }
  },
  {
    name: "Shanghai, China",
    city: "Shanghai",
    country: "China",
    coords: { latitude: 31.2304, longitude: 121.4737 }
  },
  {
    name: "Beijing, China",
    city: "Beijing",
    country: "China",
    coords: { latitude: 39.9042, longitude: 116.4074 }
  },
  {
    name: "Dubai, UAE",
    city: "Dubai",
    country: "UAE",
    coords: { latitude: 25.2048, longitude: 55.2708 }
  },
  {
    name: "Mumbai, India",
    city: "Mumbai",
    country: "India",
    coords: { latitude: 19.076, longitude: 72.8777 }
  },
  {
    name: "Bangkok, Thailand",
    city: "Bangkok",
    country: "Thailand",
    coords: { latitude: 13.7563, longitude: 100.5018 }
  },
  {
    name: "Toronto, Canada",
    city: "Toronto",
    country: "Canada",
    coords: { latitude: 43.6532, longitude: -79.3832 }
  },
  {
    name: "São Paulo, Brazil",
    city: "São Paulo",
    country: "Brazil",
    coords: { latitude: -23.5505, longitude: -46.6333 }
  },
  {
    name: "Mexico City, Mexico",
    city: "Mexico City",
    country: "Mexico",
    coords: { latitude: 19.4326, longitude: -99.1332 }
  },
  {
    name: "Moscow, Russia",
    city: "Moscow",
    country: "Russia",
    coords: { latitude: 55.7558, longitude: 37.6173 }
  }
] as const;

export type LocationPresetName = (typeof LOCATION_PRESETS)[number]["name"];

export function createPositionFromPreset(preset: LocationPreset): Position {
  return {
    coords: {
      latitude: preset.coords.latitude,
      longitude: preset.coords.longitude,
      accuracy: 10,
      altitude: 50,
      altitudeAccuracy: 5,
      heading: null,
      speed: 0
    },
    timestamp: Date.now()
  };
}

export function createPosition(cityName: LocationPresetName): Position {
  const preset = LOCATION_PRESETS.find((p) => p.name === cityName);
  if (!preset) {
    throw new Error(`Unknown city: ${cityName}`);
  }
  return createPositionFromPreset(preset);
}
