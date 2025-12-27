import React, { createContext, useContext, useEffect } from "react";
import type { ModernGeolocationConfiguration } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
/**
 * Geolocation context value.
 */
export interface GeolocationContextValue {
  config: ModernGeolocationConfiguration;
}

/**
 * Geolocation context.
 */
const GeolocationContext = createContext<GeolocationContextValue | null>(null);

/**
 * Hook to access geolocation context.
 * Throws error if used outside GeolocationProvider.
 */
export function useGeolocationContext(): GeolocationContextValue {
  const context = useContext(GeolocationContext);

  if (!context) {
    throw new Error(
      "useGeolocationContext must be used within GeolocationProvider. " +
        "Wrap your app with <GeolocationProvider> at the root level."
    );
  }

  return context;
}

/**
 * Props for GeolocationProvider component.
 */
export interface GeolocationProviderProps {
  /**
   * Global geolocation configuration.
   * This is applied once when the provider mounts.
   */
  config: ModernGeolocationConfiguration;

  /**
   * Child components that can use geolocation hooks.
   */
  children: React.ReactNode;
}

/**
 * Provider component for global geolocation configuration.
 *
 * This component should wrap your app at the root level.
 * It injects the configuration into the native module on mount.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <GeolocationProvider
 *       config={{
 *         authorizationLevel: 'whenInUse',
 *         enableBackgroundLocationUpdates: false,
 *         locationProvider: 'auto'
 *       }}
 *     >
 *       <NavigationContainer>
 *         <YourApp />
 *       </NavigationContainer>
 *     </GeolocationProvider>
 *   );
 * }
 * ```
 */
export function GeolocationProvider({
  config,
  children
}: GeolocationProviderProps) {
  useEffect(() => {
    // Set configuration on mount
    NitroGeolocationHybridObject.setConfiguration(config);

    // Auto-request permission if configured
    if (config.autoRequestPermission === true) {
      NitroGeolocationHybridObject.requestPermission().catch((error) => {
        console.warn("Auto permission request failed:", error);
      });
    }
  }, [config]);

  const value: GeolocationContextValue = {
    config
  };

  return (
    <GeolocationContext.Provider value={value}>
      {children}
    </GeolocationContext.Provider>
  );
}
