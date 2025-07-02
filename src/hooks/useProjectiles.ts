import { useState, useCallback, useRef } from "react";

interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  createdAt: number;
}

interface PlayerPosition {
  x: number;
  y: number;
}

interface MapConfig {
  width: number;
  height: number;
}

export const useProjectiles = (
  playerPosition: PlayerPosition,
  rotation: any,
  mapConfig: MapConfig,
) => {
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projectileIdRef = useRef(0);

  // Clean up expired projectiles
  const cleanupProjectiles = useCallback(() => {
    const now = Date.now();
    setProjectiles(
      (prev) => prev.filter((projectile) => now - projectile.createdAt < 3000), // Remove after 3 seconds
    );
  }, []);

  // Handle shooting
  const handleShoot = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();

      const currentRotation = rotation.get();
      const rotationRad = (currentRotation * Math.PI) / 180;

      // Calculate projectile travel distance and target
      const projectileRange = 500;
      const targetX =
        playerPosition.x + Math.cos(rotationRad) * projectileRange;
      const targetY =
        playerPosition.y + Math.sin(rotationRad) * projectileRange;

      // Wrap target coordinates
      const wrappedTargetX =
        targetX < 0
          ? mapConfig.width + targetX
          : targetX >= mapConfig.width
            ? targetX - mapConfig.width
            : targetX;
      const wrappedTargetY =
        targetY < 0
          ? mapConfig.height + targetY
          : targetY >= mapConfig.height
            ? targetY - mapConfig.height
            : targetY;

      const newProjectile: Projectile = {
        id: `projectile-${++projectileIdRef.current}`,
        x: playerPosition.x,
        y: playerPosition.y,
        targetX: wrappedTargetX,
        targetY: wrappedTargetY,
        speed: 1.0, // Animation duration in seconds
        createdAt: Date.now(),
      };

      setProjectiles((prev) => [...prev, newProjectile]);

      // Clean up old projectiles
      setTimeout(cleanupProjectiles, 100);
    },
    [playerPosition, rotation, mapConfig, cleanupProjectiles],
  );

  return {
    projectiles,
    handleShoot,
  };
};
