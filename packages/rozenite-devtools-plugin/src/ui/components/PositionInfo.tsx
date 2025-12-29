import type { Position } from "../../shared/types";

interface PositionInfoProps {
  position: Position;
  onUpdatePosition: (lat: number, lng: number) => void;
}

export function PositionInfo({
  position,
  onUpdatePosition
}: PositionInfoProps) {
  const handleInputChange = (
    field: "latitude" | "longitude",
    value: string
  ) => {
    const numValue = Number.parseFloat(value);
    if (Number.isNaN(numValue)) return;

    if (field === "latitude") {
      onUpdatePosition(numValue, position.coords.longitude);
    } else {
      onUpdatePosition(position.coords.latitude, numValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="bg-card rounded-lg p-4 mb-5 shadow-sm border border-border transition-all">
      <h3 className="text-lg font-bold mb-2.5 text-card-foreground">
        Current Position
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <label
            htmlFor="latitude-input"
            className="text-xs text-muted-foreground block mb-1"
          >
            Latitude
          </label>
          <input
            id="latitude-input"
            type="number"
            step="0.000001"
            value={position.coords.latitude}
            onChange={(e) => handleInputChange("latitude", e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label
            htmlFor="longitude-input"
            className="text-xs text-muted-foreground block mb-1"
          >
            Longitude
          </label>
          <input
            id="longitude-input"
            type="number"
            step="0.000001"
            value={position.coords.longitude}
            onChange={(e) => handleInputChange("longitude", e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground block mb-1">
            Accuracy
          </div>
          <p className="text-sm text-muted-foreground py-1">
            {position.coords.accuracy}m
          </p>
        </div>
        <div>
          <div className="text-xs text-muted-foreground block mb-1">
            Altitude
          </div>
          <p className="text-sm text-muted-foreground py-1">
            {position.coords.altitude?.toFixed(1) ?? "N/A"}m
          </p>
        </div>
        <div>
          <div className="text-xs text-muted-foreground block mb-1">
            Heading
          </div>
          <p className="text-sm text-muted-foreground py-1">
            {position.coords.heading?.toFixed(1) ?? "N/A"}°
          </p>
        </div>
        <div>
          <div className="text-xs text-muted-foreground block mb-1">Speed</div>
          <p className="text-sm text-muted-foreground py-1">
            {position.coords.speed?.toFixed(2) ?? "0.00"}m/s
          </p>
        </div>
      </div>
    </div>
  );
}
