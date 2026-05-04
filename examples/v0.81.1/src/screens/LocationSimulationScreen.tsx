import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function LocationSimulationScreen() {
  return (
    <DefaultScreen
      nativeGeolocation
      sections={["permission", "currentPosition"]}
      subtitle="Location simulation contract"
    />
  );
}
