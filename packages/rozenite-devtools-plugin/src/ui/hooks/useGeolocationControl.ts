import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useCallback, useEffect, useState } from "react";
import {
  LOCATION_PRESETS,
  createPositionFromPreset
} from "../../shared/presets";
import type { DevtoolsUIEvents, Position } from "../../shared/types";
import {
  convertSpeedToDegreesPerInterval,
  createUpdatedCoordinates
} from "../utils/geolocation";
import { useDevtoolsUI } from "./useDevtoolsUI";

const DEFAULT_POSITION: Position = createPositionFromPreset(
  LOCATION_PRESETS[0]
);

export function useGeolocationControl() {
  const client = useRozeniteDevToolsClient<DevtoolsUIEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [isSpeedLocked, setIsSpeedLocked] = useState(false);
  const [lockedSpeed, setLockedSpeed] = useState(27.78); // Default: 27.78 m/s (100 km/h)

  // Send position to React Native app
  const sendPosition = useCallback(
    (newPosition: Position) => {
      client?.send("position", newPosition);
    },
    [client]
  );

  // Setup devtools UI message handling
  useDevtoolsUI({
    client,
    onInitialPosition: useCallback(
      (data: Position) => {
        setPosition(data);
        sendPosition(data);
      },
      [sendPosition]
    )
  });

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
    const INTERVAL_MS = 50;
    const DEFAULT_SPEED_MPS = 27.78; // Default speed: 27.78 m/s (100 km/h)
    const speedInMetersPerSecond = isSpeedLocked
      ? lockedSpeed
      : DEFAULT_SPEED_MPS;
    const keySpeed = convertSpeedToDegreesPerInterval(
      speedInMetersPerSecond,
      INTERVAL_MS
    );
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

            if (pressedKeys.has("arrowup")) latDelta += 1;
            if (pressedKeys.has("arrowdown")) latDelta -= 1;
            if (pressedKeys.has("arrowleft")) lngDelta -= 1;
            if (pressedKeys.has("arrowright")) lngDelta += 1;

            if (latDelta !== 0 || lngDelta !== 0) {
              // Normalize diagonal movement to maintain constant speed
              const magnitude = Math.sqrt(
                latDelta * latDelta + lngDelta * lngDelta
              );
              latDelta = (latDelta / magnitude) * keySpeed;
              lngDelta = (lngDelta / magnitude) * keySpeed;

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
          }, INTERVAL_MS);
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
  }, [sendPosition, isSpeedLocked, lockedSpeed]);

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
    setPositionFromPreset,
    isSpeedLocked,
    setIsSpeedLocked,
    lockedSpeed,
    setLockedSpeed
  };
}
