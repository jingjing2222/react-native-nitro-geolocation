import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { GeocodedLocation } from "../publicTypes";

/**
 * Convert a human-readable address into candidate coordinates.
 *
 * Uses the platform geocoder: Android `Geocoder` and iOS `CLGeocoder`.
 * Results and availability depend on platform networking/geocoder services.
 *
 * @param address - Human-readable address or place query
 * @returns Promise resolving to matching coordinate candidates
 * @throws LocationError if input is invalid or the platform geocoder fails
 */
export function geocode(address: string): Promise<GeocodedLocation[]> {
  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.geocode(address, resolve, reject);
  });
}
