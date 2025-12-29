import { useJoystick } from "../hooks/useJoystick";

interface JoystickProps {
  onMove: (deltaX: number, deltaY: number) => void;
}

export function Joystick({ onMove }: JoystickProps) {
  const { position, baseRef, handlers } = useJoystick({ onMove });

  return (
    <div className="flex flex-col items-center">
      <p className="text-base text-muted-foreground m-0 mb-2.5">
        Joystick or WASD/Arrow keys
      </p>
      <div
        ref={baseRef}
        className="w-30 h-30 rounded-full bg-muted relative cursor-pointer select-none transition-colors"
        onMouseDown={(e) => handlers.handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handlers.handleMove(e.clientX, e.clientX)}
        onMouseUp={handlers.handleEnd}
        onMouseLeave={handlers.handleEnd}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          handlers.handleStart(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          handlers.handleMove(touch.clientX, touch.clientY);
        }}
        onTouchEnd={handlers.handleEnd}
      >
        <div
          className="w-10 h-10 rounded-full bg-primary absolute top-1/2 left-1/2 -mt-5 -ml-5 transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`
          }}
        />
      </div>
    </div>
  );
}
