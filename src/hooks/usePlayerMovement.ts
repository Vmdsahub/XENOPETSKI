import { useCallback, useRef, useEffect } from "react";
import { useMotionValue } from "framer-motion";

interface PlayerPosition {
  x: number;
  y: number;
}

interface MapConfig {
  width: number;
  height: number;
}

interface ContainerSize {
  width: number;
  height: number;
}

export const usePlayerMovement = (
  playerPosition: PlayerPosition,
  setPlayerPosition: (pos: PlayerPosition) => void,
  cameraX: any,
  cameraY: any,
  containerSize: ContainerSize,
  mapConfig: MapConfig,
) => {
  const rotation = useMotionValue(0);
  const isMovingRef = useRef(false);
  const targetPositionRef = useRef(playerPosition);
  const animationFrameRef = useRef<number>();

  // Wrap coordinates for fluid map boundaries
  const wrapCoordinate = useCallback((value: number, max: number) => {
    if (value < 0) return max + value;
    if (value >= max) return value - max;
    return value;
  }, []);

  // Update camera to follow player
  const updateCamera = useCallback(() => {
    const targetCameraX = -(playerPosition.x - containerSize.width / 2);
    const targetCameraY = -(playerPosition.y - containerSize.height / 2);

    cameraX.set(targetCameraX);
    cameraY.set(targetCameraY);
  }, [playerPosition, containerSize, cameraX, cameraY]);

  // Smooth movement animation
  const animateMovement = useCallback(() => {
    if (!isMovingRef.current) return;

    const current = playerPosition;
    const target = targetPositionRef.current;

    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      const speed = 0.08;
      const newX = current.x + dx * speed;
      const newY = current.y + dy * speed;

      setPlayerPosition({
        x: wrapCoordinate(newX, mapConfig.width),
        y: wrapCoordinate(newY, mapConfig.height),
      });
    } else {
      isMovingRef.current = false;
    }

    animationFrameRef.current = requestAnimationFrame(animateMovement);
  }, [playerPosition, setPlayerPosition, wrapCoordinate, mapConfig]);

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calculate world position considering camera offset
      const worldX = mouseX - cameraX.get();
      const worldY = mouseY - cameraY.get();

      // Calculate rotation angle
      const dx = worldX - playerPosition.x;
      const dy = worldY - playerPosition.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      rotation.set(angle);

      // Set target position for smooth movement
      targetPositionRef.current = {
        x: wrapCoordinate(worldX, mapConfig.width),
        y: wrapCoordinate(worldY, mapConfig.height),
      };

      if (!isMovingRef.current) {
        isMovingRef.current = true;
        animateMovement();
      }
    },
    [
      playerPosition,
      rotation,
      cameraX,
      cameraY,
      wrapCoordinate,
      mapConfig,
      animateMovement,
    ],
  );

  // Handle touch movement
  const handleTouch = useCallback(
    (event: React.TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      // Calculate world position considering camera offset
      const worldX = touchX - cameraX.get();
      const worldY = touchY - cameraY.get();

      // Calculate rotation angle
      const dx = worldX - playerPosition.x;
      const dy = worldY - playerPosition.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      rotation.set(angle);

      // Set target position for smooth movement
      targetPositionRef.current = {
        x: wrapCoordinate(worldX, mapConfig.width),
        y: wrapCoordinate(worldY, mapConfig.height),
      };

      if (!isMovingRef.current) {
        isMovingRef.current = true;
        animateMovement();
      }
    },
    [
      playerPosition,
      rotation,
      cameraX,
      cameraY,
      wrapCoordinate,
      mapConfig,
      animateMovement,
    ],
  );

  // Update camera when player position changes
  useEffect(() => {
    updateCamera();
  }, [updateCamera]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    rotation,
    handleMouseMove,
    handleTouch,
  };
};
