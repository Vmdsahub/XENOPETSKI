import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

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
  { count: 200, parallax: 0.1, zIndex: 0 },
  { count: 150, parallax: 0.3, zIndex: 1 },
  { count: 100, parallax: 0.5, zIndex: 2 },
  { count: 50, parallax: 0.7, zIndex: 3 },
  { count: 30, parallax: 1.5, zIndex: 25 },
  { count: 20, parallax: 2.0, zIndex: 26 },
];

// Planet data for center circle
const PLANETS = [
  {
    id: "gaia",
    name: "Gaia Selvagem",
    angle: 0,
    color: "#22c55e",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fbd58c52f19d147f09ff36547a19e0305?format=webp&width=400",
  },
  {
    id: "frozen",
    name: "Mundo Gelado",
    angle: 60,
    color: "#3b82f6",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fea3ec3d920794634bdf7d66a1159511b?format=webp&width=400",
  },
  {
    id: "desert",
    name: "Reino Desértico",
    angle: 120,
    color: "#f59e0b",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F7066e87a53b34231ac837e59befecf75?format=webp&width=400",
  },
  {
    id: "village",
    name: "Aldeia Pacífica",
    angle: 180,
    color: "#8b5cf6",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F02782c34d2cd4353a884ab021ce35173?format=webp&width=400",
  },
  {
    id: "alien",
    name: "Dimensão Alienígena",
    angle: 240,
    color: "#ec4899",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Facb3e8e8eb33422a88b01594f5d1c470?format=webp&width=400",
  },
  {
    id: "station",
    name: "Estação Mineradora",
    angle: 300,
    color: "#6b7280",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F213c17a38e9545088415b03b5c9e9319?format=webp&width=400",
  },
];

export const GalaxyMap: React.FC<GalaxyMapProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ultra-smooth player position with springs
  const playerX = useSpring(CENTER_X, {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  });
  const playerY = useSpring(CENTER_Y, {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  });

  // Mouse tracking
  const [mousePos, setMousePos] = useState({ x: 200, y: 200 });
  const [isMouseInside, setIsMouseInside] = useState(false);
  const [containerSize, setContainerSize] = useState({
    width: 400,
    height: 400,
  });

  // Projectiles
  const [projectiles, setProjectiles] = useState<
    Array<{
      id: string;
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      startTime: number;
    }>
  >([]);

  // Ultra-smooth camera with springs
  const cameraX = useSpring(0, { stiffness: 150, damping: 25, mass: 0.3 });
  const cameraY = useSpring(0, { stiffness: 150, damping: 25, mass: 0.3 });

  // Ship rotation
  const rotation = useSpring(0, { stiffness: 200, damping: 30, mass: 0.2 });

  // Generate stars once
  const [starLayers] = useState(() =>
    STAR_LAYERS.map((layer, index) => ({
      ...layer,
      stars: generateStars(layer.count, index),
    })),
  );

  // Wrap coordinates
  const wrapCoordinate = (value: number, max: number) => {
    if (value < 0) return max + value;
    if (value >= max) return value - max;
    return value;
  };

  // Update container size
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

  // Ultra-smooth movement system
  useEffect(() => {
    let animationId: number;

    const updateMovement = () => {
      if (!isMouseInside) {
        animationId = requestAnimationFrame(updateMovement);
        return;
      }

      const shipScreenX = containerSize.width / 2;
      const shipScreenY = containerSize.height / 2;

      // Calculate direction and distance to mouse
      const dx = mousePos.x - shipScreenX;
      const dy = mousePos.y - shipScreenY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Dead zone for stopping
      const deadZone = 25;

      if (distance > deadZone) {
        // Calculate target position with smooth interpolation
        const maxDistance = 150;
        const speedMultiplier = Math.min(distance / maxDistance, 1);
        const moveSpeed = speedMultiplier * 2.5;

        // Get current positions
        const currentX = playerX.get();
        const currentY = playerY.get();

        // Calculate new target positions
        const moveX = (dx / distance) * moveSpeed;
        const moveY = (dy / distance) * moveSpeed;

        const newX = wrapCoordinate(currentX + moveX, MAP_SIZE);
        const newY = wrapCoordinate(currentY + moveY, MAP_SIZE);

        // Set smooth targets
        playerX.set(newX);
        playerY.set(newY);
      }

      // Always rotate to point at mouse
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      rotation.set(angle);

      // Update camera to follow player smoothly
      const targetCameraX = -(playerX.get() - containerSize.width / 2);
      const targetCameraY = -(playerY.get() - containerSize.height / 2);
      cameraX.set(targetCameraX);
      cameraY.set(targetCameraY);

      animationId = requestAnimationFrame(updateMovement);
    };

    animationId = requestAnimationFrame(updateMovement);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [
    isMouseInside,
    mousePos,
    containerSize,
    playerX,
    playerY,
    rotation,
    cameraX,
    cameraY,
  ]);

  // Handle mouse movement
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    setMousePos({ x: mouseX, y: mouseY });
  }, []);

  // Handle mouse enter/leave
  const handleMouseEnter = useCallback(() => {
    setIsMouseInside(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsMouseInside(false);
  }, []);

  // Handle shooting - shoot towards MOUSE position, not ship direction
  const handleShoot = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calculate world position of mouse click
      const worldMouseX = mouseX - cameraX.get();
      const worldMouseY = mouseY - cameraY.get();

      // Shoot from ship position towards mouse world position
      const shipX = playerX.get();
      const shipY = playerY.get();

      // Calculate direction from ship to mouse
      const dx = worldMouseX - shipX;
      const dy = worldMouseY - shipY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 10) return; // Don't shoot if too close

      // Calculate target position (extend line from ship through mouse)
      const range = 500;
      const targetX = wrapCoordinate(shipX + (dx / distance) * range, MAP_SIZE);
      const targetY = wrapCoordinate(shipY + (dy / distance) * range, MAP_SIZE);

      const newProjectile = {
        id: `proj-${Date.now()}-${Math.random()}`,
        x: shipX,
        y: shipY,
        targetX,
        targetY,
        startTime: Date.now(),
      };

      setProjectiles((prev) => [...prev, newProjectile]);

      // Remove projectile after travel time
      setTimeout(() => {
        setProjectiles((prev) => prev.filter((p) => p.id !== newProjectile.id));
      }, 800);
    },
    [playerX, playerY, cameraX, cameraY],
  );

  // Handle planet clicks
  const handlePlanetClick = useCallback((planetId: string) => {
    const planet = PLANETS.find((p) => p.id === planetId);
    alert(
      `🌍 ${planet?.name || "Planeta"}\n\nVocê clicou no planeta! Em breve será possível explorar este mundo.`,
    );
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
              onClick={(e) => {
                e.stopPropagation();
                handlePlanetClick(planet.id);
              }}
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
              <div
                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 
                            bg-black/80 text-white text-xs px-2 py-1 rounded 
                            opacity-0 group-hover:opacity-100 transition-opacity
                            pointer-events-none whitespace-nowrap"
              >
                {planet.name}
              </div>
            </motion.div>
          );
        })}

        {/* Projectiles */}
        {projectiles.map((projectile) => (
          <motion.div
            key={projectile.id}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full z-15 shadow-lg"
            style={{
              left: projectile.x - 1,
              top: projectile.y - 1,
              boxShadow: "0 0 8px rgba(255, 255, 0, 0.8)",
            }}
            initial={{
              x: 0,
              y: 0,
            }}
            animate={{
              x: projectile.targetX - projectile.x,
              y: projectile.targetY - projectile.y,
            }}
            transition={{
              duration: 0.8,
              ease: "linear",
            }}
          />
        ))}

        {/* Player Ship */}
        <motion.div
          className="absolute z-20"
          style={{
            left: playerX,
            top: playerY,
            x: -20,
            y: -20,
          }}
        >
          <motion.div
            className="w-10 h-10"
            style={{
              rotate: rotation,
            }}
            animate={{
              y: [0, -0.3, 0, 0.3, 0],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F4d288afc148aaaf0f73eedbc53e2b%2F01991177d397420f9f7b55d6a6283724?format=webp&width=800"
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
                duration: 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* UI */}
      <div className="absolute top-4 left-4 text-white text-sm font-mono z-30">
        <div>X: {playerX.get().toFixed(0)}</div>
        <div>Y: {playerY.get().toFixed(0)}</div>
        <div>R: {rotation.get().toFixed(0)}°</div>
      </div>
    </div>
  );
};
