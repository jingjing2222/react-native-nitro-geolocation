import { StyleSheet, Text, View } from "react-native";
import { useJoystick } from "../hooks/useJoystick";

interface JoystickProps {
  onMove: (deltaX: number, deltaY: number) => void;
}

export function Joystick({ onMove }: JoystickProps) {
  const { position, baseRef, handlers } = useJoystick({ onMove });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Joystick or WASD/Arrow keys</Text>
      <div
        ref={baseRef}
        style={joystickStyles.base}
        onMouseDown={(e) => handlers.handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handlers.handleMove(e.clientX, e.clientY)}
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
          style={{
            ...joystickStyles.stick,
            transform: `translate(${position.x}px, ${position.y}px)`
          }}
        />
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center"
  },
  label: {
    fontSize: 16,
    marginBottom: 10
  }
});

const joystickStyles = {
  base: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e0e0e0",
    position: "relative" as const,
    cursor: "pointer",
    userSelect: "none" as const
  },
  stick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2196F3",
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
    transition: "transform 0.1s"
  }
};
