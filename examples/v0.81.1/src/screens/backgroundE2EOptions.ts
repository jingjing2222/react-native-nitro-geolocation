import { Platform } from "react-native";
import { getBackgroundConfiguration } from "react-native-nitro-geolocation/background";

export const MISSING_NOTIFICATION_ERROR =
  "Android background tracking requires android.foregroundService notification options";

export const backgroundE2EOptions = {
  trackingMode:
    Platform.OS === "android"
      ? ("activityAware" as const)
      : ("continuous" as const),
  accuracy: { android: "balanced" as const, ios: "nearestTenMeters" as const },
  granularity: "permission" as const,
  interval: 10_000,
  fastestInterval: 5_000,
  distanceFilter: 25,
  persist: true,
  maxStoredLocations: 0,
  maxStoredEvents: 0,
  stopOnTerminate: false,
  startOnBoot: true,
  android: {
    foregroundService: {
      notificationTitle: "Background tracking active",
      notificationText: "Recording location updates for E2E validation",
      notificationChannelId: "nitro-background-location-e2e",
      notificationChannelName: "Nitro Background Location E2E",
      notificationColor: "#123456",
      stopActionTitle: "Stop E2E tracking"
    }
  },
  ios: {
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true
  },
  geofencing: {
    initialTrigger: ["enter" as const],
    notificationResponsiveness: 2000
  },
  activityRecognition: {
    enabled: Platform.OS === "android",
    interval: 10_000,
    stopOnStill: true,
    minimumConfidence: 70
  }
};

export const assertBackgroundE2EConfiguration = async () => {
  const configuration = await getBackgroundConfiguration();
  if (!configuration) {
    throw new Error("Native background configuration was not persisted.");
  }

  const expected = backgroundE2EOptions;
  const commonMatches =
    configuration.trackingMode === expected.trackingMode &&
    configuration.accuracy?.android === expected.accuracy.android &&
    configuration.accuracy?.ios === expected.accuracy.ios &&
    configuration.granularity === expected.granularity &&
    configuration.interval === expected.interval &&
    configuration.fastestInterval === expected.fastestInterval &&
    configuration.distanceFilter === expected.distanceFilter &&
    configuration.persist === expected.persist &&
    configuration.maxStoredLocations === expected.maxStoredLocations &&
    configuration.maxStoredEvents === expected.maxStoredEvents &&
    configuration.stopOnTerminate === expected.stopOnTerminate &&
    configuration.startOnBoot === expected.startOnBoot;
  const platformMatches =
    Platform.OS === "android"
      ? configuration.android?.foregroundService.notificationTitle ===
          expected.android.foregroundService.notificationTitle &&
        configuration.android.foregroundService.notificationText ===
          expected.android.foregroundService.notificationText &&
        configuration.android.foregroundService.notificationColor ===
          expected.android.foregroundService.notificationColor &&
        configuration.android.foregroundService.stopActionTitle ===
          expected.android.foregroundService.stopActionTitle &&
        configuration.geofencing?.initialTrigger?.join(",") === "enter" &&
        configuration.geofencing.notificationResponsiveness === 2000 &&
        configuration.activityRecognition?.enabled === true
      : configuration.ios?.pausesLocationUpdatesAutomatically === false &&
        configuration.ios.showsBackgroundLocationIndicator === true;

  if (!commonMatches || !platformMatches) {
    throw new Error("Native background configuration round-trip mismatched.");
  }
};
