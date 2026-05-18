import { Platform } from "react-native";
import {
  type BackgroundEvent,
  markStoredBackgroundEventsDelivered,
  markStoredBackgroundLocationsDelivered,
  registerBackgroundTask
} from "react-native-nitro-geolocation/background";

if (Platform.OS === "android") {
  registerBackgroundTask(async (event: BackgroundEvent) => {
    await markStoredBackgroundEventsDelivered([event.id]);

    if (event.type === "location" && event.location.id) {
      await markStoredBackgroundLocationsDelivered([event.location.id]);
    }
  });
}
