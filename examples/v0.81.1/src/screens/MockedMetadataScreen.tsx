import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function MockedMetadataScreen() {
  return (
    <DefaultScreen
      sections={["currentPosition"]}
      subtitle="Mocked location metadata contract"
      title="Mocked Location Metadata"
    />
  );
}
