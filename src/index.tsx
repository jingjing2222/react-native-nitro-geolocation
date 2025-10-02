import { NitroModules } from "react-native-nitro-modules";
import type {
  NitroGeolocation,
  GeolocationConfiguration,
  GeolocationOptions,
  GeolocationResponse,
  GeolocationError,
} from "./NitroGeolocation.nitro";

const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocation>("NitroGeolocation");

const Geolocation = {
  /**
   * Invokes the success callback once with the latest location info.
   * Supported options: timeout (ms), maximumAge (ms), enableHighAccuracy (bool)
   */
  getCurrentPosition: function (
    success: (position: GeolocationResponse) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions,
  ) {
    NitroGeolocationHybridObject.getCurrentPosition(success, error, options);
  },

  /**
   * Invokes the success callback whenever the location changes.
   * Returns a watchID that can be used with clearWatch.
   */
  watchPosition: function (
    success: (position: GeolocationResponse) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions,
  ): number {
    return NitroGeolocationHybridObject.watchPosition(success, error, options);
  },

  /**
   * Clears the watch started by watchPosition.
   */
  clearWatch: function (watchID: number) {
    NitroGeolocationHybridObject.clearWatch(watchID);
  },

  /**
   * @deprecated Use clearWatch instead.
   */
  stopObserving: function () {
    console.warn(
      "`Geolocation.stopObserving` is deprecated. Use `Geolocation.clearWatch` instead.",
    );
    NitroGeolocationHybridObject.stopObserving();
  },

  /**
   * Request suitable Location permission.
   */
  requestAuthorization: function (
    success?: () => void,
    error?: (error: GeolocationError) => void,
  ) {
    NitroGeolocationHybridObject.requestAuthorization()
      .then(() => {
        if (success) {
          success();
        }
      })
      .catch((err) => {
        if (error) {
          error(err);
        }
      });
  },

  /**
   * Sets configuration options that will be used in all location requests.
   */
  setRNConfiguration: function (config: GeolocationConfiguration) {
    NitroGeolocationHybridObject.setRNConfiguration(config);
  },
};

export type {
  GeolocationConfiguration,
  GeolocationOptions,
  GeolocationResponse,
  GeolocationError,
  GeolocationCoordinates,
} from "./NitroGeolocation.nitro";

export default Geolocation;
