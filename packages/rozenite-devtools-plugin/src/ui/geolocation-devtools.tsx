import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeolocationPluginEvents, Position } from "../shared/types";

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

export default function GeolocationDevToolsPanel() {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Send position to React Native app
  const sendPosition = useCallback(
    (newPosition: Position) => {
      client?.send("position", newPosition);
    },
    [client]
  );

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

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current).setView(
      [position.coords.latitude, position.coords.longitude],
      15
    );

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add marker
    const marker = L.marker([
      position.coords.latitude,
      position.coords.longitude
    ]).addTo(map);

    // Handle map clicks
    map.on("click", (e: L.LeafletMouseEvent) => {
      updatePosition(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
    };
  }, []);

  // Update marker position when position changes
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;

    const latLng = L.latLng(
      position.coords.latitude,
      position.coords.longitude
    );
    markerRef.current.setLatLng(latLng);
    mapRef.current.setView(latLng);
  }, [position.coords.latitude, position.coords.longitude]);

  // Joystick movement
  const handleJoystickMove = useCallback(
    (deltaX: number, deltaY: number) => {
      // Convert pixel movement to lat/lng delta (adjust scale as needed)
      const latDelta = -deltaY * 0.0001;
      const lngDelta = deltaX * 0.0001;

      updatePosition(
        position.coords.latitude + latDelta,
        position.coords.longitude + lngDelta
      );
    },
    [position, updatePosition]
  );

  return (
    <View style={styles.container}>
      {/* Current Position Display */}
      <View style={styles.positionInfo}>
        <Text style={styles.infoTitle}>Current Position</Text>
        <Text style={styles.infoText}>
          Lat: {position.coords.latitude.toFixed(6)}
        </Text>
        <Text style={styles.infoText}>
          Lng: {position.coords.longitude.toFixed(6)}
        </Text>
        <Text style={styles.infoText}>
          Accuracy: {position.coords.accuracy}m
        </Text>
      </View>

      {/* Leaflet Map */}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: 400,
          marginBottom: 20,
          borderRadius: 8,
          overflow: "hidden"
        }}
      />

      {/* Joystick */}
      <View style={styles.joystickContainer}>
        <Text style={styles.joystickLabel}>Use joystick to move</Text>
        <Joystick onMove={handleJoystickMove} />
      </View>
    </View>
  );
}

// Simple Joystick Component
function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    updatePosition(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    updatePosition(clientX, clientY);
  };

  const handleEnd = () => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    // Limit to circle
    const maxDistance = 40;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance;
      deltaY = (deltaY / distance) * maxDistance;
    }

    setPosition({ x: deltaX, y: deltaY });

    // Trigger movement continuously
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      onMove(deltaX, deltaY);
    }, 100);
  };

  return (
    <div
      ref={baseRef}
      style={joystickStyles.base}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => isDragging && handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }}
      onTouchEnd={handleEnd}
    >
      <div
        style={{
          ...joystickStyles.stick,
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      />
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 20
  },
  positionInfo: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5
  },
  mapContainer: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: "hidden"
  },
  joystickContainer: {
    alignItems: "center"
  },
  joystickLabel: {
    fontSize: 16,
    marginBottom: 10
  }
});

const joystickStyles = {
  base: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e0e0e0",
    position: "relative" as const,
    cursor: "pointer",
    userSelect: "none" as const
  },
  stick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2196F3",
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
    transition: "transform 0.1s"
  }
};
