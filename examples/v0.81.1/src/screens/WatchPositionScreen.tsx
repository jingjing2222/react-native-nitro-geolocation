import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function WatchPositionScreen() {
  return (
    <DefaultScreen
      nativeGeolocation
      sections={["permission", "watchPosition"]}
      subtitle="Watch position contract"
    />
  );
}
