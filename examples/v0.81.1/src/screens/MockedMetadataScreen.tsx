import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function MockedMetadataScreen() {
  return (
    <DefaultScreen
      nativeGeolocation
      sections={["permission", "currentPosition", "metadataCache"]}
      subtitle="Mocked location metadata contract"
      title="Mocked Location Metadata"
    />
  );
}
