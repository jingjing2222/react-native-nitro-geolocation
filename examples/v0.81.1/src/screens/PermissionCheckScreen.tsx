import React from "react";
import DefaultScreen from "./DefaultScreen";

export default function PermissionCheckScreen() {
  return (
    <DefaultScreen
      sections={["permission"]}
      subtitle="Permission check contract"
    />
  );
}
