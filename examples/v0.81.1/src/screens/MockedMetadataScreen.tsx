import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function MockedMetadataScreen() {
  return (
    <DefaultScreen
      sections={["permission", "currentPosition"]}
      subtitle="Mocked location metadata contract"
      title="Mocked Location Metadata"
    />
  );
}
