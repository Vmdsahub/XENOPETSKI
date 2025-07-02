import React from "react";
import { motion } from "framer-motion";

interface CenterObjectsProps {
  centerX: number;
  centerY: number;
  onPlanetClick: (planetId: string) => void;
}

interface Planet {
  id: string;
  name: string;
  image: string;
  angle: number;
  color: string;
}

const planets: Planet[] = [
  {
    id: "gaia",
    name: "Gaia Selvagem",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fbd58c52f19d147f09ff36547a19e0305?format=webp&width=400",
    angle: 0,
    color: "#22c55e",
  },
  {
    id: "frozen",
    name: "Mundo Gelado",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fea3ec3d920794634bdf7d66a1159511b?format=webp&width=400",
    angle: 60,
    color: "#3b82f6",
  },
  {
    id: "desert",
    name: "Reino Desértico",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F7066e87a53b34231ac837e59befecf75?format=webp&width=400",
    angle: 120,
    color: "#f59e0b",
  },
  {
    id: "village",
    name: "Aldeia Pacífica",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F02782c34d2cd4353a884ab021ce35173?format=webp&width=400",
    angle: 180,
    color: "#8b5cf6",
  },
  {
    id: "alien",
    name: "Dimensão Alienígena",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Facb3e8e8eb33422a88b01594f5d1c470?format=webp&width=400",
    angle: 240,
    color: "#ec4899",
  },
  {
    id: "station",
    name: "Estação Mineradora",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F213c17a38e9545088415b03b5c9e9319?format=webp&width=400",
    angle: 300,
    color: "#6b7280",
  },
];

export const CenterObjects: React.FC<CenterObjectsProps> = ({
  centerX,
  centerY,
  onPlanetClick,
}) => {
  const radius = 200; // Distance from center

  return (
    <div className="absolute z-10">
      {/* Central point marker */}
      <motion.div
        className="absolute w-4 h-4 bg-white rounded-full border-2 border-yellow-400"
        style={{
          left: centerX - 8,
          top: centerY - 8,
        }}
        animate={{
          boxShadow: [
            "0 0 10px rgba(255, 255, 0, 0.5)",
            "0 0 30px rgba(255, 255, 0, 0.8)",
            "0 0 10px rgba(255, 255, 0, 0.5)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Planets in circle */}
      {planets.map((planet) => {
        const angleRad = (planet.angle * Math.PI) / 180;
        const x = centerX + Math.cos(angleRad) * radius;
        const y = centerY + Math.sin(angleRad) * radius;

        return (
          <motion.div
            key={planet.id}
            className="absolute cursor-pointer group"
            style={{
              left: x - 30,
              top: y - 30,
            }}
            onClick={() => onPlanetClick(planet.id)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              rotate: {
                duration: 20 + Math.random() * 10,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          >
            {/* Planet image */}
            <div className="relative w-16 h-16">
              <img
                src={planet.image}
                alt={planet.name}
                className="w-full h-full rounded-full object-cover border-2 border-white/30 shadow-lg"
              />

              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${planet.color}40 0%, transparent 70%)`,
                }}
                animate={{
                  opacity: [0.3, 0.8, 0.3],
                  scale: [1, 1.3, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: Math.random() * 2,
                }}
              />
            </div>

            {/* Planet name tooltip */}
            <motion.div
              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 
                         bg-black/80 text-white text-xs px-2 py-1 rounded 
                         opacity-0 group-hover:opacity-100 transition-opacity
                         pointer-events-none whitespace-nowrap"
              initial={{ opacity: 0, y: 10 }}
              whileHover={{ opacity: 1, y: 0 }}
            >
              {planet.name}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};
