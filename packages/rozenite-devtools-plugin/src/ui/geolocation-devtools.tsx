import "./globals.css";
import { LeafletMap } from "./components/LeafletMap";
import { LocationPresetSelector } from "./components/LocationPresetSelector";
import { PositionInfo } from "./components/PositionInfo";
import { SpeedControl } from "./components/SpeedControl";
import { useDarkMode } from "./hooks/useDarkMode";
import { useGeolocationControl } from "./hooks/useGeolocationControl";

export default function GeolocationDevToolsPanel() {
  const {
    position,
    updatePosition,
    setPositionFromPreset,
    isSpeedLocked,
    setIsSpeedLocked,
    lockedSpeed,
    setLockedSpeed
  } = useGeolocationControl();
  useDarkMode();

  return (
    <div className="min-h-screen bg-background p-5 transition-colors">
      <LocationPresetSelector
        onSelect={setPositionFromPreset}
        currentPosition={position}
      />
      <SpeedControl
        isSpeedLocked={isSpeedLocked}
        lockedSpeed={lockedSpeed}
        onSpeedLockChange={setIsSpeedLocked}
        onSpeedChange={setLockedSpeed}
      />
      <PositionInfo position={position} onUpdatePosition={updatePosition} />
      <LeafletMap position={position} onMapClick={updatePosition} />
      <p className="text-center text-sm text-muted-foreground mt-5">
        Use arrow keys to navigate or click on the map
      </p>
    </div>
  );
}
