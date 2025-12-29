import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  LOCATION_PRESETS,
  createPositionFromPreset
} from "../../shared/presets";
import type { Position } from "../../shared/types";

interface LocationPresetSelectorProps {
  onSelect: (position: Position) => void;
  currentPosition: Position;
}

export function LocationPresetSelector({
  onSelect,
  currentPosition
}: LocationPresetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (index: number) => {
    const preset = LOCATION_PRESETS[index];
    onSelect(createPositionFromPreset(preset));
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative mb-5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-card border border-border rounded-lg px-4 py-3 text-left text-sm text-card-foreground hover:bg-accent transition-colors flex items-center justify-between"
      >
        <span>
          {LOCATION_PRESETS.find(
            (p) =>
              Math.abs(p.coords.latitude - currentPosition.coords.latitude) <
                0.0001 &&
              Math.abs(p.coords.longitude - currentPosition.coords.longitude) <
                0.0001
          )?.name || "Custom Location"}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {LOCATION_PRESETS.map((preset, index) => (
            <button
              type="button"
              key={index}
              onClick={() => handleSelect(index)}
              className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent transition-colors border-b border-border last:border-b-0"
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
