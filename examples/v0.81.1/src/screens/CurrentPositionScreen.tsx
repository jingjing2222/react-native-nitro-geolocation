import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function CurrentPositionScreen() {
  return (
    <DefaultScreen
      sections={["permission", "currentPosition"]}
      subtitle="Current position contract"
    />
  );
}
