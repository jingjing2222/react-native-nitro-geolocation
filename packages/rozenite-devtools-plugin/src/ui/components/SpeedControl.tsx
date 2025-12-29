import { useEffect, useState } from "react";

interface SpeedControlProps {
  isSpeedLocked: boolean;
  lockedSpeed: number;
  onSpeedLockChange: (locked: boolean) => void;
  onSpeedChange: (speed: number) => void;
}

export function SpeedControl({
  isSpeedLocked,
  lockedSpeed,
  onSpeedLockChange,
  onSpeedChange
}: SpeedControlProps) {
  const [inputValue, setInputValue] = useState(lockedSpeed.toString());

  // Sync with external changes
  useEffect(() => {
    setInputValue(lockedSpeed.toString());
  }, [lockedSpeed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val === "") {
      // Allow empty string without updating state
      return;
    }

    const num = Number.parseFloat(val);
    if (!Number.isNaN(num) && num >= 0) {
      onSpeedChange(num);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg border border-border shadow-sm mb-5">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isSpeedLocked}
            onChange={(e) => onSpeedLockChange(e.target.checked)}
            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary cursor-pointer"
          />
          <span className="text-sm font-medium text-foreground">
            Lock Speed
          </span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            disabled={!isSpeedLocked}
            step="0.1"
            min="0"
            className="px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed w-32"
            placeholder="Speed"
          />
          <span className="text-xs text-muted-foreground">m/s</span>
        </div>
        <span className="text-xs text-muted-foreground">
          (default: 27.78 m/s = 100 km/h)
        </span>
      </div>
    </div>
  );
}
