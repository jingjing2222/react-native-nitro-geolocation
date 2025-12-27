import React, { type ReactNode, useEffect } from 'react';
import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import type { ModernGeolocationConfiguration } from '../NitroGeolocation.nitro';

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
  children: ReactNode;
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
  children,
}: GeolocationProviderProps) {
  useEffect(() => {
    // Set configuration on mount
    NitroGeolocationHybridObject.setConfiguration(config);
  }, [config]);

  return <>{children}</>;
}
