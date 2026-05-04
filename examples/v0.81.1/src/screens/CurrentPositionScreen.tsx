import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function CurrentPositionScreen() {
  return (
    <DefaultScreen
      nativeGeolocation
      sections={["permission", "currentPosition"]}
      subtitle="Current position contract"
    />
  );
}
