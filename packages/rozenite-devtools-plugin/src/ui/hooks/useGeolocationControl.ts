import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LOCATION_PRESETS,
  createPositionFromPreset
} from "../../shared/presets";
import type { GeolocationPluginEvents, Position } from "../../shared/types";
import { createUpdatedCoordinates } from "../utils/geolocation";
import { useDevtoolsMessages } from "./useDevtoolsMessages";

const DEFAULT_POSITION: Position = createPositionFromPreset(
  LOCATION_PRESETS[0]
);

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

  // Setup message handlers
  const messageHandlers = useMemo(
    () => ({
      initialPosition: (data: Position) => {
        console.log("[Devtools UI] Received initial position:", data);
        setPosition(data);
        sendPosition(data);
      }
    }),
    [sendPosition]
  );

  useDevtoolsMessages(client, messageHandlers);

  // Send "ready" signal when devtools UI mounts
  useEffect(() => {
    if (client) {
      console.log("[Devtools UI] Sending ready signal");
      client.send("ready", null);
    }
  }, [client]);

  // Update position and send to app
  const updatePosition = useCallback(
    (lat: number, lng: number) => {
      setPosition((prevPosition) => {
        const newTimestamp = Date.now();
        const newCoords = createUpdatedCoordinates(
          prevPosition.coords,
          lat,
          lng,
          prevPosition.timestamp,
          newTimestamp
        );
        const newPosition: Position = {
          coords: newCoords,
          timestamp: newTimestamp
        };
        sendPosition(newPosition);
        return newPosition;
      });
    },
    [sendPosition]
  );

  // Arrow key controls
  useEffect(() => {
    const keySpeed = 0.0001; // Base speed for keyboard
    let keyboardInterval: NodeJS.Timeout | null = null;
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        pressedKeys.add(key);

        // Start continuous movement if not already running
        if (!keyboardInterval) {
          keyboardInterval = setInterval(() => {
            let latDelta = 0;
            let lngDelta = 0;

            if (pressedKeys.has("arrowup")) latDelta += keySpeed;
            if (pressedKeys.has("arrowdown")) latDelta -= keySpeed;
            if (pressedKeys.has("arrowleft")) lngDelta -= keySpeed;
            if (pressedKeys.has("arrowright")) lngDelta += keySpeed;

            if (latDelta !== 0 || lngDelta !== 0) {
              setPosition((prevPosition) => {
                const newLat = prevPosition.coords.latitude + latDelta;
                const newLng = prevPosition.coords.longitude + lngDelta;
                const newTimestamp = Date.now();

                const newCoords = createUpdatedCoordinates(
                  prevPosition.coords,
                  newLat,
                  newLng,
                  prevPosition.timestamp,
                  newTimestamp
                );

                const newPosition: Position = {
                  coords: newCoords,
                  timestamp: newTimestamp
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

  // Set position from preset
  const setPositionFromPreset = useCallback(
    (preset: Position) => {
      setPosition(preset);
      sendPosition(preset);
    },
    [sendPosition]
  );

  return {
    position,
    updatePosition,
    setPositionFromPreset
  };
}
