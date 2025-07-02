import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";

interface GalaxyMapProps {}

// Map configuration - 10,000 x 10,000 pixel world
const MAP_SIZE = 10000;
const CENTER_X = MAP_SIZE / 2;
const CENTER_Y = MAP_SIZE / 2;

// Generate stars for parallax layers
const generateStars = (count: number, layerIndex: number) => {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      id: `star-${layerIndex}-${i}`,
      x: Math.random() * MAP_SIZE * 2,
      y: Math.random() * MAP_SIZE * 2,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    });
  }
  return stars;
};

// Star layers configuration
const STAR_LAYERS = [
  { count: 200, parallax: 0.1, zIndex: 0 }, // Far background
  { count: 150, parallax: 0.3, zIndex: 1 },
  { count: 100, parallax: 0.5, zIndex: 2 },
  { count: 50, parallax: 0.7, zIndex: 3 },  // Near background
  { count: 30, parallax: 1.5, zIndex: 25 }, // Foreground
  { count: 20, parallax: 2.0, zIndex: 26 }, // Far foreground
];

// Planet data for center circle
const PLANETS = [
  { id: "gaia", name: "Gaia Selvagem", angle: 0, color: "#22c55e", image: "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fbd58c52f19d147f09ff36547a19e0305?format=webp&width=400" },
  { id: "frozen", name: "Mundo Gelado", angle: 60, color: "#3b82f6", image: "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fea3ec3d920794634bdf7d66a1159511b?format=webp&width=400" },
  { id: "desert", name: "Reino Desértico", angle: 120, color: "#f59e0b", image: "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F7066e87a53b34231ac837e59befecf75?format=webp&width=400" },
  { id: "village", name: "Aldeia Pacífica", angle: 180, color: "#8b5cf6", image: "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F02782c34d2cd4353a884ab021ce35173?format=webp&width=400" },
  { id: "alien", name: "Dimensão Alienígena", angle: 240, color: "#ec4899", image: "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Facb3e8e8eb33422a88b01594f5d1c470?format=webp&width=400" },
  { id: "station", name: "Estação Mineradora", angle: 300, color: "#6b7280", image: "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F213c17a38e9545088415b03b5c9e9319?format=webp&width=400" },
];

export const GalaxyMap: React.FC<GalaxyMapProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Player position and movement
  const [playerPosition, setPlayerPosition] = useState({ x: CENTER_X, y: CENTER_Y });
  const [mousePosition, setMousePosition] = useState({ x: 200, y: 200 });
  const [isMouseInside, setIsMouseInside] = useState(false);
  const [projectiles, setProjectiles] = useState<Array<{id: string, x: number, y: number, targetX: number, targetY: number}>>([]);

  // Camera follows player
  const cameraX = useMotionValue(0);
  const cameraY = useMotionValue(0);

  // Ship rotation based on mouse
  const rotation = useMotionValue(0);

  // Animation frame for continuous movement
  const animationFrameRef = useRef<number>();

  // Generate stars once
  const [starLayers] = useState(() =>
    STAR_LAYERS.map((layer, index) => ({
      ...layer,
      stars: generateStars(layer.count, index),
    }))
  );

  // Wrap coordinates
  const wrapCoordinate = (value: number, max: number) => {
    if (value < 0) return max + value;
    if (value >= max) return value - max;
    return value;
  };

  // Update camera when player moves
  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      cameraX.set(-(playerPosition.x - rect.width / 2));
      cameraY.set(-(playerPosition.y - rect.height / 2));
    }
  }, [playerPosition, cameraX, cameraY]);

  // Movement loop with higher frequency
  useEffect(() => {
    let animationId: number;
    let lastTime = 0;

    const moveShip = (currentTime: number) => {
      // Target 60 FPS for smooth movement
      if (currentTime - lastTime >= 16) { // ~60 FPS
        lastTime = currentTime;

        if (!isMouseInside || !containerRef.current) {
          animationId = requestAnimationFrame(moveShip);
          return;
        }

      const rect = containerRef.current.getBoundingClientRect();
      const shipScreenX = rect.width / 2;
      const shipScreenY = rect.height / 2;

      // Calculate distance from mouse to ship on screen
      const dx = mousePosition.x - shipScreenX;
      const dy = mousePosition.y - shipScreenY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Dead zone - if mouse is too close to ship, don't move
      const deadZone = 30;
      if (distance > deadZone) {
        // Calculate rotation (add 90 degrees to fix ship orientation - ship image points up by default)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        rotation.set(angle);

        // Calculate speed based on distance (further = faster, more fluid)
        const maxDistance = 200;
        const maxSpeed = 3;
        const speedMultiplier = Math.min(distance / maxDistance, 1);
        const speed = speedMultiplier * maxSpeed;

        // Move ship in world coordinates with smoother interpolation
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;

        setPlayerPosition(prev => ({
          x: wrapCoordinate(prev.x + moveX, MAP_SIZE),
          y: wrapCoordinate(prev.y + moveY, MAP_SIZE),
        }));
      } else {
        // Still rotate even in dead zone so ship points to mouse
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        rotation.set(angle);
      }

      animationId = requestAnimationFrame(moveShip);
    };

    if (isMouseInside) {
      animationId = requestAnimationFrame(moveShip);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isMouseInside, mousePosition, rotation]);

  // Handle mouse movement (only track position)
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    setMousePosition({ x: mouseX, y: mouseY });
  }, []);

  // Handle mouse enter/leave
  const handleMouseEnter = useCallback(() => {
    setIsMouseInside(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsMouseInside(false);
  }, []);

  // Handle shooting
  const handleShoot = useCallback((event: React.MouseEvent) => {
    event.preventDefault();

    const currentRotation = rotation.get();
    const rotationRad = (currentRotation * Math.PI) / 180;

    const range = 300;
    const targetX = wrapCoordinate(playerPosition.x + Math.cos(rotationRad) * range, MAP_SIZE);
    const targetY = wrapCoordinate(playerPosition.y + Math.sin(rotationRad) * range, MAP_SIZE);

    const newProjectile = {
      id: `proj-${Date.now()}`,
      x: playerPosition.x,
      y: playerPosition.y,
      targetX,
      targetY,
    };

    setProjectiles(prev => [...prev, newProjectile]);

    // Remove projectile after animation
    setTimeout(() => {
      setProjectiles(prev => prev.filter(p => p.id !== newProjectile.id));
    }, 1000);
  }, [playerPosition, rotation]);

  // Handle planet clicks
  const handlePlanetClick = useCallback((planetId: string) => {
    const planet = PLANETS.find(p => p.id === planetId);
    alert(`🌍 ${planet?.name || 'Planeta'}\n\nVocê clicou no planeta! Em breve será possível explorar este mundo.`);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-96 bg-black overflow-hidden rounded-2xl cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleShoot}
    >
      {/* Star layers */}
      {starLayers.map((layer, layerIndex) => (
        <motion.div
          key={layerIndex}
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: layer.zIndex,
            x: cameraX,
            y: cameraY,
            scale: layer.parallax,
          }}
        >
          {layer.stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute rounded-full bg-white"
              style={{
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
                boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, 0.5)`,
              }}
              animate={{
                opacity: [star.opacity, star.opacity * 0.3, star.opacity],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      ))}

      {/* Main world container */}
      <motion.div
        className="absolute inset-0"
        style={{
          x: cameraX,
          y: cameraY,
        }}
      >
        {/* Circular barrier */}
        <div className="absolute z-10">
          <svg
            className="absolute pointer-events-none"
            style={{
              left: CENTER_X - 850,
              top: CENTER_Y - 850,
              width: 1700,
              height: 1700,
            }}
          >
            <circle
              cx="850"
              cy="850"
              r="800"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeDasharray="20 10"
              opacity="0.6"
            />
            <text
              x="850"
              y="50"
              textAnchor="middle"
              fill="#fbbf24"
              fontSize="14"
              fontFamily="monospace"
              opacity="0.8"
            >
              ⚠ ZONA ESPECIAL ⚠
            </text>
          </svg>
        </div>

        {/* Center marker */}
        <motion.div
          className="absolute w-4 h-4 bg-yellow-400 rounded-full z-10"
          style={{
            left: CENTER_X - 8,
            top: CENTER_Y - 8,
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

        {/* Planets */}
        {PLANETS.map((planet) => {
          const angleRad = (planet.angle * Math.PI) / 180;
          const radius = 200;
          const x = CENTER_X + Math.cos(angleRad) * radius;
          const y = CENTER_Y + Math.sin(angleRad) * radius;

          return (
            <motion.div
              key={planet.id}
              className="absolute cursor-pointer group z-10"
              style={{
                left: x - 25,
                top: y - 25,
              }}
              onClick={() => handlePlanetClick(planet.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden">
                <img
                  src={planet.image}
                  alt={planet.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2
                            bg-black/80 text-white text-xs px-2 py-1 rounded
                            opacity-0 group-hover:opacity-100 transition-opacity
                            pointer-events-none whitespace-nowrap">
                {planet.name}
              </div>
            </motion.div>
          );
        })}

        {/* Projectiles */}
        {projectiles.map((projectile) => (
          <motion.div
            key={projectile.id}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full z-15"
            style={{
              left: projectile.x - 1,
              top: projectile.y - 1,
            }}
            animate={{
              x: projectile.targetX - projectile.x,
              y: projectile.targetY - projectile.y,
            }}
            transition={{
              duration: 1,
              ease: "linear",
            }}
          />
        ))}

        {/* Player Ship */}
        <motion.div
          className="absolute z-20"
          style={{
            left: playerPosition.x - 20,
            top: playerPosition.y - 20,
          }}
        >
          <motion.div
            className="w-10 h-10"
            style={{
              rotate: rotation,
            }}
            animate={{
              y: [0, -0.5, 0, 0.5, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F4d288afc418148aaaf0f73eedbc53e2b%2F01991177d397420f9f7b55d6a6283724?format=webp&width=800"
              alt="Spaceship"
              className="w-full h-full object-contain drop-shadow-lg"
            />
            {/* Engine trail */}
            <motion.div
              className="absolute w-1 h-4 bg-gradient-to-t from-transparent to-blue-400 transform -translate-x-1/2"
              style={{
                top: "100%",
                left: "50%",
                zIndex: -1,
              }}
              animate={{
                opacity: [0.3, 0.8, 0.3],
                scaleY: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* UI */}
      <div className="absolute top-4 left-4 text-white text-sm font-mono z-30">
        <div>X: {playerPosition.x.toFixed(0)}</div>
        <div>Y: {playerPosition.y.toFixed(0)}</div>
        <div>R: {rotation.get().toFixed(0)}°</div>
      </div>
    </div>
  );
};