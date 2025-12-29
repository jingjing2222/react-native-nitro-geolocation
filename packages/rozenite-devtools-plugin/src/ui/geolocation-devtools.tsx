import { StyleSheet, View } from "react-native";
import { Joystick } from "./components/Joystick";
import { LeafletMap } from "./components/LeafletMap";
import { PositionInfo } from "./components/PositionInfo";
import { useGeolocationControl } from "./hooks/useGeolocationControl";

export default function GeolocationDevToolsPanel() {
  const { position, updatePosition, handleJoystickMove } =
    useGeolocationControl();

  return (
    <View style={styles.container}>
      <PositionInfo position={position} />
      <LeafletMap position={position} onMapClick={updatePosition} />
      <Joystick onMove={handleJoystickMove} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 20
  }
});
