import React, { useMemo } from "react";
import { motion, MotionValue } from "framer-motion";

interface StarFieldProps {
  layerCount: number;
  cameraX: MotionValue<number>;
  cameraY: MotionValue<number>;
  zIndex: "behind" | "above";
  mapConfig: { width: number; height: number };
}

interface Star {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
}

const generateStars = (
  count: number,
  width: number,
  height: number,
  layerIndex: number,
): Star[] => {
  const stars: Star[] = [];
  const colors = ["#ffffff", "#fef9e7", "#e8f4fd", "#f0f8ff", "#fff5ee"];

  for (let i = 0; i < count; i++) {
    stars.push({
      id: `star-${layerIndex}-${i}`,
      x: Math.random() * width * 2, // Extend beyond map bounds for seamless wrapping
      y: Math.random() * height * 2,
      size: Math.random() * 3 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  return stars;
};

export const StarField: React.FC<StarFieldProps> = ({
  layerCount,
  cameraX,
  cameraY,
  zIndex,
  mapConfig,
}) => {
  const starLayers = useMemo(() => {
    const layers = [];
    const starCounts = zIndex === "behind" ? [200, 150, 100, 50] : [30, 20]; // More stars behind, fewer above

    for (let i = 0; i < layerCount; i++) {
      const parallaxFactor =
        zIndex === "behind"
          ? 0.1 + i * 0.2 // Slower movement for background layers
          : 1.5 + i * 0.5; // Faster movement for foreground layers

      const stars = generateStars(
        starCounts[i] || 50,
        mapConfig.width,
        mapConfig.height,
        i,
      );

      layers.push({ stars, parallaxFactor, layerIndex: i });
    }

    return layers;
  }, [layerCount, zIndex, mapConfig.width, mapConfig.height]);

  return (
    <>
      {starLayers.map(({ stars, parallaxFactor, layerIndex }) => (
        <motion.div
          key={`layer-${layerIndex}`}
          className={`absolute inset-0 pointer-events-none ${
            zIndex === "above" ? "z-30" : "z-0"
          }`}
          style={{
            x: cameraX,
            y: cameraY,
            transform: `scale(${parallaxFactor})`,
          }}
        >
          {stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute rounded-full"
              style={{
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                backgroundColor: star.color,
                opacity: star.opacity,
                boxShadow: `0 0 ${star.size * 2}px ${star.color}`,
              }}
              animate={{
                opacity: [star.opacity, star.opacity * 0.3, star.opacity],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 2,
              }}
            />
          ))}
        </motion.div>
      ))}
    </>
  );
};
