import L from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Position } from "../../shared/types";

interface LeafletMapProps {
  position: Position;
  onMapClick: (lat: number, lng: number) => void;
}

export function LeafletMap({ position, onMapClick }: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create custom icon to fix Leaflet default marker icon issue
    const customIcon = L.icon({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Create map with keyboard disabled
    const map = L.map(mapContainerRef.current, {
      keyboard: false
    }).setView([position.coords.latitude, position.coords.longitude], 15);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add marker with custom icon
    const marker = L.marker(
      [position.coords.latitude, position.coords.longitude],
      { icon: customIcon }
    ).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
    };
  }, []);

  // Update click handler when onMapClick changes
  useEffect(() => {
    if (!mapRef.current) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };

    mapRef.current.on("click", handleClick);

    return () => {
      mapRef.current?.off("click", handleClick);
    };
  }, [onMapClick]);

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

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-100 mb-5 rounded-lg overflow-hidden border border-border shadow-sm transition-all"
    />
  );
}
