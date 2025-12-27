import React, { createContext, useContext } from "react";
import type { GeolocationClient } from "../GeolocationClient";

/**
 * Geolocation context value.
 */
export interface GeolocationContextValue {
  client: GeolocationClient;
}

/**
 * Geolocation context.
 */
const GeolocationContext = createContext<GeolocationContextValue | null>(null);

/**
 * Hook to access GeolocationClient from context.
 * Throws error if used outside GeolocationClientProvider.
 */
export function useGeolocationClient(): GeolocationClient {
  const context = useContext(GeolocationContext);

  if (!context) {
    throw new Error(
      "useGeolocationClient must be used within GeolocationClientProvider. " +
        "Wrap your component with <GeolocationClientProvider client={...}> at the root level."
    );
  }

  return context.client;
}

/**
 * Props for GeolocationProvider component.
 */
export interface GeolocationProviderProps {
  /**
   * GeolocationClient instance (required).
   * Create with: new GeolocationClient({...config})
   */
  client: GeolocationClient;

  /**
   * Child components that can use geolocation hooks.
   */
  children: React.ReactNode;
}

/**
 * Provider component for GeolocationClient.
 *
 * This component should wrap your app at the root level.
 * It provides a GeolocationClient instance to all child components via context.
 *
 * @example
 * ```tsx
 * // Create client instance
 * const geolocationClient = new GeolocationClient({
 *   authorizationLevel: 'whenInUse',
 *   enableBackgroundLocationUpdates: false,
 *   locationProvider: 'auto'
 * });
 *
 * function App() {
 *   return (
 *     <GeolocationClientProvider client={geolocationClient}>
 *       <NavigationContainer>
 *         <YourApp />
 *       </NavigationContainer>
 *     </GeolocationClientProvider>
 *   );
 * }
 * ```
 */
export function GeolocationProvider({
  client,
  children
}: GeolocationProviderProps) {
  const value: GeolocationContextValue = {
    client
  };

  return (
    <GeolocationContext.Provider value={value}>
      {children}
    </GeolocationContext.Provider>
  );
}

// Modern alias (preferred)
export const GeolocationClientProvider = GeolocationProvider;
