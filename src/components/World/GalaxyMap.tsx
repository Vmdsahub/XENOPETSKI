import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { PlayerShip } from "./PlayerShip";
import { StarField } from "./StarField";
import { CenterObjects } from "./CenterObjects";
import { CircularBarrier } from "./CircularBarrier";
import { usePlayerMovement } from "../../hooks/usePlayerMovement";
import { useProjectiles } from "../../hooks/useProjectiles";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";

interface GalaxyMapProps {}

// Map configuration - 10,000 x 10,000 pixel world
const MAP_CONFIG = {
  width: 10000,
  height: 10000,
  centerX: 5000,
  centerY: 5000,
} as const;

export const GalaxyMap: React.FC<GalaxyMapProps> = () => {
  const { user } = useAuthStore();
  const { setCurrentScreen, setSelectedWorld } = useGameStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 400,
    height: 400,
  });

  // Camera position (follows player)
  const cameraX = useMotionValue(0);
  const cameraY = useMotionValue(0);

  // Player position in world coordinates
  const [playerPosition, setPlayerPosition] = useState({
    x: MAP_CONFIG.centerX,
    y: MAP_CONFIG.centerY,
  });

  // Custom hooks for player movement and shooting
  const { rotation, handleMouseMove, handleTouch } = usePlayerMovement(
    playerPosition,
    setPlayerPosition,
    cameraX,
    cameraY,
    containerSize,
    MAP_CONFIG,
  );

  const { projectiles, handleShoot } = useProjectiles(
    playerPosition,
    rotation,
    MAP_CONFIG,
  );

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Handle planet clicks
  const handlePlanetClick = useCallback(
    (planetId: string) => {
      console.log(`Planet clicked: ${planetId}`);
      // You can implement planet interaction logic here
      setSelectedWorld(planetId);
      setCurrentScreen("worldDetail");
    },
    [setSelectedWorld, setCurrentScreen],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-96 bg-black overflow-hidden rounded-2xl cursor-crosshair"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouch}
      onMouseDown={handleShoot}
      onTouchStart={handleShoot}
    >
      {/* Background stars (4 layers behind ship) */}
      <StarField
        layerCount={4}
        cameraX={cameraX}
        cameraY={cameraY}
        zIndex="behind"
        mapConfig={MAP_CONFIG}
      />

      {/* Main game world container */}
      <motion.div
        className="absolute inset-0"
        style={{
          x: cameraX,
          y: cameraY,
        }}
      >
        {/* Circular barrier around center */}
        <CircularBarrier
          centerX={MAP_CONFIG.centerX}
          centerY={MAP_CONFIG.centerY}
          radius={800}
        />

        {/* Center objects (6 clickable planets/icons) */}
        <CenterObjects
          centerX={MAP_CONFIG.centerX}
          centerY={MAP_CONFIG.centerY}
          onPlanetClick={handlePlanetClick}
        />

        {/* Projectiles */}
        {projectiles.map((projectile) => (
          <motion.div
            key={projectile.id}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full shadow-lg"
            style={{
              left: projectile.x - 4,
              top: projectile.y - 4,
            }}
            animate={{
              x: projectile.targetX - projectile.x,
              y: projectile.targetY - projectile.y,
            }}
            transition={{
              duration: projectile.speed,
              ease: "linear",
            }}
          />
        ))}

        {/* Player Ship */}
        <motion.div
          className="absolute"
          style={{
            left: playerPosition.x - 20,
            top: playerPosition.y - 20,
          }}
        >
          <PlayerShip rotation={rotation} />
        </motion.div>
      </motion.div>

      {/* Foreground stars (2 layers above ship) */}
      <StarField
        layerCount={2}
        cameraX={cameraX}
        cameraY={cameraY}
        zIndex="above"
        mapConfig={MAP_CONFIG}
      />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 text-white text-sm font-mono">
        <div>X: {playerPosition.x.toFixed(0)}</div>
        <div>Y: {playerPosition.y.toFixed(0)}</div>
      </div>

      <div className="absolute top-4 right-4 text-white text-sm font-mono">
        <div>Rotation: {rotation.get().toFixed(0)}°</div>
      </div>
    </div>
  );
};
