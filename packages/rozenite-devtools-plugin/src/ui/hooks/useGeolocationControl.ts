import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useCallback, useEffect, useState } from "react";
import type { GeolocationPluginEvents, Position } from "../../shared/types";

const DEFAULT_POSITION: Position = {
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    accuracy: 10,
    altitude: 50,
    altitudeAccuracy: 5,
    heading: 45,
    speed: 1.5
  },
  timestamp: Date.now()
};

export function useGeolocationControl() {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);

  // Send position to React Native app
  const sendPosition = useCallback(
    (newPosition: Position) => {
      client?.send("position", newPosition);
    },
    [client]
  );

  // Send initial position when component mounts
  useEffect(() => {
    if (client) {
      sendPosition(DEFAULT_POSITION);
    }
  }, [client, sendPosition]);

  // Update position and send to app
  const updatePosition = useCallback(
    (lat: number, lng: number) => {
      const newPosition: Position = {
        coords: {
          ...position.coords,
          latitude: lat,
          longitude: lng
        },
        timestamp: Date.now()
      };
      setPosition(newPosition);
      sendPosition(newPosition);
    },
    [position, sendPosition]
  );

  // Joystick movement with speed based on distance from center
  const handleJoystickMove = useCallback(
    (deltaX: number, deltaY: number) => {
      // Calculate distance from center (0 to 50)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = 50;

      // Speed multiplier: increases quadratically with distance
      const speedMultiplier = (distance / maxDistance) ** 2 * 5;

      // Convert pixel movement to lat/lng delta with speed
      const latDelta = -deltaY * 0.00001 * speedMultiplier;
      const lngDelta = deltaX * 0.00001 * speedMultiplier;

      updatePosition(
        position.coords.latitude + latDelta,
        position.coords.longitude + lngDelta
      );
    },
    [position, updatePosition]
  );

  // Keyboard controls
  useEffect(() => {
    const keySpeed = 0.0001; // Base speed for keyboard
    let keyboardInterval: NodeJS.Timeout | null = null;
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright"
        ].includes(key)
      ) {
        e.preventDefault();
        pressedKeys.add(key);

        // Start continuous movement if not already running
        if (!keyboardInterval) {
          keyboardInterval = setInterval(() => {
            let latDelta = 0;
            let lngDelta = 0;

            if (pressedKeys.has("w") || pressedKeys.has("arrowup"))
              latDelta += keySpeed;
            if (pressedKeys.has("s") || pressedKeys.has("arrowdown"))
              latDelta -= keySpeed;
            if (pressedKeys.has("a") || pressedKeys.has("arrowleft"))
              lngDelta -= keySpeed;
            if (pressedKeys.has("d") || pressedKeys.has("arrowright"))
              lngDelta += keySpeed;

            if (latDelta !== 0 || lngDelta !== 0) {
              setPosition((prevPosition) => {
                const newPosition: Position = {
                  coords: {
                    ...prevPosition.coords,
                    latitude: prevPosition.coords.latitude + latDelta,
                    longitude: prevPosition.coords.longitude + lngDelta
                  },
                  timestamp: Date.now()
                };
                sendPosition(newPosition);
                return newPosition;
              });
            }
          }, 50);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeys.delete(key);

      // Stop interval if no keys are pressed
      if (pressedKeys.size === 0 && keyboardInterval) {
        clearInterval(keyboardInterval);
        keyboardInterval = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (keyboardInterval) clearInterval(keyboardInterval);
    };
  }, [sendPosition]);

  return {
    position,
    updatePosition,
    handleJoystickMove
  };
}
