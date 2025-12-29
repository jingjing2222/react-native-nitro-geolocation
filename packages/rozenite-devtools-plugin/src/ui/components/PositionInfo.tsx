import type { Position } from "../../shared/types";

interface PositionInfoProps {
  position: Position;
}

export function PositionInfo({ position }: PositionInfoProps) {
  return (
    <div className="bg-card rounded-lg p-4 mb-5 shadow-sm border border-border transition-all">
      <h3 className="text-lg font-bold mb-2.5 text-card-foreground">
        Current Position
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground">
          Lat: {position.coords.latitude.toFixed(6)}
        </p>
        <p className="text-sm text-muted-foreground">
          Lng: {position.coords.longitude.toFixed(6)}
        </p>
        <p className="text-sm text-muted-foreground">
          Accuracy: {position.coords.accuracy}m
        </p>
        <p className="text-sm text-muted-foreground">
          Altitude: {position.coords.altitude?.toFixed(1) ?? "N/A"}m
        </p>
        <p className="text-sm text-muted-foreground">
          Heading: {position.coords.heading?.toFixed(1) ?? "N/A"}°
        </p>
        <p className="text-sm text-muted-foreground">
          Speed: {position.coords.speed?.toFixed(2) ?? "0.00"}m/s
        </p>
      </div>
    </div>
  );
}
