import { Platform } from "react-native";
import {
  getCurrentPosition,
  getProviderStatus
} from "react-native-nitro-geolocation";
import { getDisplayErrorMessage } from "../utils/locationErrors";
import { runWithNativeGeolocation } from "../utils/nativeGeolocation";
import {
  LIVE_PROVIDER_SELECTION_TIMEOUT_MS,
  assertPreferredProvider,
  assertRealDevicePosition,
  configureAutoProvider,
  configureNativePlatformProvider,
  configurePlatformProvider,
  configurePlayServices,
  isAndroidPlatformProvider
} from "./androidRequestOptionHelpers";
import type { AndroidRequestOptionsSetResult } from "./androidRequestOptionsResults";

type ProviderSelectionRunnerDeps = {
  ensurePermission: () => Promise<unknown>;
  refreshPermission: () => Promise<unknown>;
  setResult: AndroidRequestOptionsSetResult;
};

export const createAndroidProviderSelectionRunners = ({
  ensurePermission,
  refreshPermission,
  setResult
}: ProviderSelectionRunnerDeps) => {
  const runAutoProviderScenario = async () => {
    setResult("autoProvider", {
      status: "running",
      message: "Requesting a live fix with locationProvider=auto"
    });

    try {
      await ensurePermission();
      configureAutoProvider();
      const providerStatus = await getProviderStatus();

      const startedAt = Date.now();
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "balanced",
            ios: "best"
          },
          granularity: "permission",
          maximumAge: 0,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          timeout: LIVE_PROVIDER_SELECTION_TIMEOUT_MS
        })
      );
      const coordinates = assertRealDevicePosition(position, startedAt, "auto");
      const providerSelection = assertPreferredProvider(
        position,
        providerStatus,
        "auto"
      );

      setResult("autoProvider", {
        status: "passed",
        message: `${providerSelection} and returned ${coordinates}; provider=${position.provider ?? "unknown"}; mocked=${position.mocked ?? "unknown"}.`
      });
    } catch (error) {
      setResult("autoProvider", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runPlayServicesProviderScenario = async () => {
    setResult("playServicesProvider", {
      status: "running",
      message: "Requesting a live fix with locationProvider=playServices"
    });

    try {
      await ensurePermission();
      configurePlayServices();
      const providerStatus = await getProviderStatus();

      const startedAt = Date.now();
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "balanced",
            ios: "best"
          },
          granularity: "permission",
          maximumAge: 0,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          timeout: LIVE_PROVIDER_SELECTION_TIMEOUT_MS
        })
      );
      const coordinates = assertRealDevicePosition(
        position,
        startedAt,
        "playServices"
      );
      const providerSelection = assertPreferredProvider(
        position,
        providerStatus,
        "playServices"
      );

      setResult("playServicesProvider", {
        status: "passed",
        message: `${providerSelection} and returned ${coordinates}; provider=${position.provider ?? "unknown"}; mocked=${position.mocked ?? "unknown"}.`
      });
    } catch (error) {
      setResult("playServicesProvider", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runPlatformProviderScenario = async () => {
    if (Platform.OS !== "android") {
      setResult("platformProvider", {
        status: "failed",
        message: "android_platform provider scenario is Android-only."
      });
      return;
    }

    try {
      await ensurePermission();

      const requestPlatformPosition = async (
        label: "android" | "android_platform",
        configureProvider: () => void
      ) => {
        setResult("platformProvider", {
          status: "running",
          message: `Requesting a fresh fix with locationProvider=${label}`
        });

        configureProvider();
        const startedAt = Date.now();
        const position = await runWithNativeGeolocation(() =>
          getCurrentPosition({
            accuracy: {
              android: "balanced",
              ios: "best"
            },
            granularity: "permission",
            maximumAge: 0,
            maxUpdateAge: 0,
            timeout: LIVE_PROVIDER_SELECTION_TIMEOUT_MS
          })
        );
        const coordinates = assertRealDevicePosition(
          position,
          startedAt,
          label
        );

        if (position.provider === "fused") {
          throw new Error(`${label} unexpectedly returned fused.`);
        }

        if (!isAndroidPlatformProvider(position.provider)) {
          throw new Error(
            `Expected ${label} platform provider, received ${position.provider ?? "unknown"}.`
          );
        }

        return `${label} returned ${coordinates}; provider=${position.provider ?? "unknown"}; mocked=${position.mocked ?? "unknown"}`;
      };

      const aliasMessage = await requestPlatformPosition(
        "android",
        configurePlatformProvider
      );
      const nativeMessage = await requestPlatformPosition(
        "android_platform",
        configureNativePlatformProvider
      );

      setResult("platformProvider", {
        status: "passed",
        message: `${aliasMessage}. ${nativeMessage}.`
      });
    } catch (error) {
      setResult("platformProvider", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  return {
    runAutoProviderScenario,
    runPlayServicesProviderScenario,
    runPlatformProviderScenario
  };
};
