import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type {
  GeocodingCoordinates,
  ReverseGeocodedAddress
} from "../publicTypes";

/**
 * Convert coordinates into candidate human-readable addresses.
 *
 * Uses the platform geocoder: Android `Geocoder` and iOS `CLGeocoder`.
 * Results and availability depend on platform networking/geocoder services.
 *
 * @param coords - Latitude and longitude to reverse geocode
 * @returns Promise resolving to matching address candidates
 * @throws LocationError if input is invalid or the platform geocoder fails
 */
export function reverseGeocode(
  coords: GeocodingCoordinates
): Promise<ReverseGeocodedAddress[]> {
  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.reverseGeocode(coords, resolve, reject);
  });
}
