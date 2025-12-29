import type { GeolocationCoordinates } from "../../shared/types";

/**
 * Calculate the heading (bearing) between two coordinates
 * @returns Heading in degrees (0-360, where 0 is North)
 */
export function calculateHeading(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const bearing = Math.atan2(y, x);
  const degrees = ((bearing * 180) / Math.PI + 360) % 360;

  return degrees;
}

/**
 * Calculate the distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate speed based on distance and time
 * @param distance Distance in meters
 * @param timeDelta Time difference in milliseconds
 * @returns Speed in meters per second
 */
export function calculateSpeed(distance: number, timeDelta: number): number {
  if (timeDelta === 0) return 0;
  return distance / (timeDelta / 1000); // Convert ms to seconds
}

/**
 * Create updated coordinates with calculated heading and speed
 */
export function createUpdatedCoordinates(
  prevCoords: GeolocationCoordinates,
  newLat: number,
  newLng: number,
  prevTimestamp: number,
  newTimestamp: number
): GeolocationCoordinates {
  const distance = calculateDistance(
    prevCoords.latitude,
    prevCoords.longitude,
    newLat,
    newLng
  );

  const timeDelta = newTimestamp - prevTimestamp;
  const speed = calculateSpeed(distance, timeDelta);

  // Only calculate heading if there's actual movement
  let heading: number | null = null;
  if (distance > 0.1) {
    // Threshold: 10cm
    heading = calculateHeading(
      prevCoords.latitude,
      prevCoords.longitude,
      newLat,
      newLng
    );
  } else {
    // Keep previous heading if no significant movement
    heading = prevCoords.heading;
  }

  return {
    latitude: newLat,
    longitude: newLng,
    altitude: prevCoords.altitude, // Keep altitude (could be enhanced with elevation API)
    accuracy: 10, // Simulated accuracy in meters
    altitudeAccuracy: 5, // Simulated altitude accuracy in meters
    heading,
    speed: speed > 0.01 ? speed : 0 // Round very small speeds to 0
  };
}
