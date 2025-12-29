import { useRef, useState } from "react";

interface UseJoystickProps {
  onMove: (deltaX: number, deltaY: number) => void;
  maxDistance?: number;
}

export function useJoystick({ onMove, maxDistance = 50 }: UseJoystickProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPressed, setIsPressed] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });

  const startMovement = (deltaX: number, deltaY: number) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Store current position
    currentPositionRef.current = { x: deltaX, y: deltaY };

    // Start continuous movement
    intervalRef.current = setInterval(() => {
      const { x, y } = currentPositionRef.current;
      onMove(x, y);
    }, 50); // Update every 50ms for smoother movement
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;

    setIsPressed(true);

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    // Limit to circle
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance;
      deltaY = (deltaY / distance) * maxDistance;
    }

    setPosition({ x: deltaX, y: deltaY });
    startMovement(deltaX, deltaY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isPressed || !baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    // Limit to circle
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance;
      deltaY = (deltaY / distance) * maxDistance;
    }

    setPosition({ x: deltaX, y: deltaY });
    currentPositionRef.current = { x: deltaX, y: deltaY };
  };

  const handleEnd = () => {
    setIsPressed(false);
    setPosition({ x: 0, y: 0 });
    currentPositionRef.current = { x: 0, y: 0 };

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return {
    position,
    isPressed,
    baseRef,
    handlers: {
      handleStart,
      handleMove,
      handleEnd
    }
  };
}
