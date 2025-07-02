import React from "react";
import { motion } from "framer-motion";

interface CircularBarrierProps {
  centerX: number;
  centerY: number;
  radius: number;
}

export const CircularBarrier: React.FC<CircularBarrierProps> = ({
  centerX,
  centerY,
  radius,
}) => {
  // Generate dashed segments around the circle
  const dashCount = 60;
  const dashLength = (2 * Math.PI * radius) / dashCount / 2; // Half the segment for gaps
  const segments = [];

  for (let i = 0; i < dashCount; i++) {
    const angle = (i / dashCount) * 2 * Math.PI;
    const startAngle = angle;
    const endAngle = angle + dashLength / radius;

    const x1 = centerX + Math.cos(startAngle) * radius;
    const y1 = centerY + Math.sin(startAngle) * radius;
    const x2 = centerX + Math.cos(endAngle) * radius;
    const y2 = centerY + Math.sin(endAngle) * radius;

    segments.push({
      id: i,
      x1,
      y1,
      x2,
      y2,
      angle: startAngle,
    });
  }

  return (
    <div className="absolute z-5">
      <svg
        className="absolute pointer-events-none"
        style={{
          left: centerX - radius - 50,
          top: centerY - radius - 50,
          width: (radius + 50) * 2,
          height: (radius + 50) * 2,
        }}
      >
        {segments.map((segment, index) => (
          <motion.line
            key={segment.id}
            x1={segment.x1 - (centerX - radius - 50)}
            y1={segment.y1 - (centerY - radius - 50)}
            x2={segment.x2 - (centerX - radius - 50)}
            y2={segment.y2 - (centerY - radius - 50)}
            stroke="#fbbf24"
            strokeWidth="2"
            opacity="0.7"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: [0.4, 0.8, 0.4],
              strokeWidth: [2, 3, 2],
            }}
            transition={{
              pathLength: { duration: 2, delay: index * 0.02 },
              opacity: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.05,
              },
              strokeWidth: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.03,
              },
            }}
          />
        ))}

        {/* Warning text around the barrier */}
        <motion.text
          x={radius + 50}
          y={20}
          textAnchor="middle"
          fill="#fbbf24"
          fontSize="12"
          fontFamily="monospace"
          className="opacity-60"
          animate={{
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          ⚠ ZONA ESPECIAL ⚠
        </motion.text>
      </svg>

      {/* Additional warning markers at cardinal points */}
      {[0, 90, 180, 270].map((angle) => {
        const angleRad = (angle * Math.PI) / 180;
        const x = centerX + Math.cos(angleRad) * (radius + 20);
        const y = centerY + Math.sin(angleRad) * (radius + 20);

        return (
          <motion.div
            key={angle}
            className="absolute w-3 h-3 bg-yellow-400 rounded-full"
            style={{
              left: x - 6,
              top: y - 6,
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: angle * 0.01,
            }}
          />
        );
      })}
    </div>
  );
};
