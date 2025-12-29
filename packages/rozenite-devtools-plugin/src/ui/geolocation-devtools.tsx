import "./globals.css";
import { Joystick } from "./components/Joystick";
import { LeafletMap } from "./components/LeafletMap";
import { PositionInfo } from "./components/PositionInfo";
import { useDarkMode } from "./hooks/useDarkMode";
import { useGeolocationControl } from "./hooks/useGeolocationControl";

export default function GeolocationDevToolsPanel() {
  const { position, updatePosition, handleJoystickMove } =
    useGeolocationControl();
  useDarkMode();

  return (
    <div className="min-h-screen bg-background p-5 transition-colors">
      <PositionInfo position={position} />
      <LeafletMap position={position} onMapClick={updatePosition} />
      <Joystick onMove={handleJoystickMove} />
    </div>
  );
}
