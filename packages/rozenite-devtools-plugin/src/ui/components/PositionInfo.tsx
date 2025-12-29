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
      <p className="text-sm mb-1 text-muted-foreground">
        Lat: {position.coords.latitude.toFixed(6)}
      </p>
      <p className="text-sm mb-1 text-muted-foreground">
        Lng: {position.coords.longitude.toFixed(6)}
      </p>
      <p className="text-sm text-muted-foreground m-0">
        Accuracy: {position.coords.accuracy}m
      </p>
    </div>
  );
}
