/**
 * Pure utility functions for geolocation operations.
 * These functions are platform-independent and can be tested with Jest.
 */

export {
  checkPermission,
  requestPermission,
  getCurrentPosition,
} from './permission';

export { isCachedLocationValid } from './cache';
export {
  LocationErrorCode,
  createLocationError,
  mapCLErrorCode,
  mapAndroidException,
  type LocationError,
} from './errors';
export {
  isBetterLocation,
  type LocationQuality,
} from './quality';
export {
  selectProvider,
  type Provider,
} from './provider';
export {
  mergeConfigurations,
  type LocationRequest,
  type AccuracyLevel,
  type MergedConfiguration,
} from './config';
