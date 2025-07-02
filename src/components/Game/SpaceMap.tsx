import React, { useRef, useEffect, useState, useCallback } from "react";

interface StarLayer {
  stars: Array<{
    x: number;
    y: number;
    size: number;
    opacity: number;
    twinkleSpeed: number;
  }>;
  parallaxSpeed: number;
  count: number;
}

interface Planet {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  name: string;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

interface GameState {
  ship: {
    x: number;
    y: number;
    angle: number;
    vx: number;
    vy: number;
  };
  camera: {
    x: number;
    y: number;
  };
  mouse: {
    x: number;
    y: number;
  };
  projectiles: Projectile[];
}

const WORLD_SIZE = 10000;
const SHIP_MAX_SPEED = 8;
const SHIP_ACCELERATION = 0.3;
const SHIP_FRICTION = 0.85;
const CENTER_X = WORLD_SIZE / 2;
const CENTER_Y = WORLD_SIZE / 2;
const CENTER_BARRIER_RADIUS = 800;
const PLANET_ORBIT_RADIUS = 300;

export const SpaceMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [gameState, setGameState] = useState<GameState>({
    ship: {
      x: CENTER_X,
      y: CENTER_Y + 400,
      angle: 0,
      vx: 0,
      vy: 0,
    },
    camera: {
      x: CENTER_X,
      y: CENTER_Y + 400,
    },
    mouse: {
      x: 0,
      y: 0,
    },
    projectiles: [],
  });

  const starLayers = useRef<StarLayer[]>([]);
  const planets = useRef<Planet[]>([]);

  // Initialize star layers
  useEffect(() => {
    starLayers.current = [
      // Background layers (behind ship)
      { stars: [], parallaxSpeed: 0.1, count: 150 },
      { stars: [], parallaxSpeed: 0.2, count: 100 },
      { stars: [], parallaxSpeed: 0.3, count: 80 },
      { stars: [], parallaxSpeed: 0.4, count: 60 },
      // Foreground layers (in front of ship)
      { stars: [], parallaxSpeed: 1.2, count: 40 },
      { stars: [], parallaxSpeed: 1.5, count: 30 },
    ];

    // Generate stars for each layer
    starLayers.current.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        layer.stars.push({
          x: Math.random() * WORLD_SIZE,
          y: Math.random() * WORLD_SIZE,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
        });
      }
    });

    // Initialize planets around center
    const planetColors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
    ];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      planets.current.push({
        id: `planet-${i}`,
        x: CENTER_X + Math.cos(angle) * PLANET_ORBIT_RADIUS,
        y: CENTER_Y + Math.sin(angle) * PLANET_ORBIT_RADIUS,
        size: 40 + Math.random() * 20,
        color: planetColors[i],
        name: `Planet ${i + 1}`,
      });
    }
  }, []);

  // Wrap coordinates to create seamless world
  const wrapCoordinate = useCallback((value: number) => {
    if (value < 0) return WORLD_SIZE + value;
    if (value > WORLD_SIZE) return value - WORLD_SIZE;
    return value;
  }, []);

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      setGameState((prev) => ({
        ...prev,
        mouse: { x: mouseX, y: mouseY },
      }));
    },
    [],
  );

  // Handle touch movement
  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || event.touches.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const touch = event.touches[0];
      const mouseX = touch.clientX - rect.left;
      const mouseY = touch.clientY - rect.top;

      setGameState((prev) => ({
        ...prev,
        mouse: { x: mouseX, y: mouseY },
      }));
    },
    [],
  );

  // Handle shooting
  const handleShoot = useCallback(
    (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      event.preventDefault();

      setGameState((prev) => {
        const ship = prev.ship;
        const projectileSpeed = 12;
        const newProjectile: Projectile = {
          id: `proj-${Date.now()}-${Math.random()}`,
          x: ship.x,
          y: ship.y,
          vx: Math.cos(ship.angle) * projectileSpeed,
          vy: Math.sin(ship.angle) * projectileSpeed,
          age: 0,
        };

        return {
          ...prev,
          projectiles: [...prev.projectiles, newProjectile],
        };
      });
    },
    [],
  );

  // Handle planet clicks
  const handlePlanetClick = useCallback((planet: Planet) => {
    alert(`Clicked on ${planet.name}!`);
  }, []);

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      setGameState((prev) => {
        const canvas = canvasRef.current;
        if (!canvas) return prev;

        // Calculate mouse position in world coordinates
        const worldMouseX = prev.mouse.x - canvas.width / 2 + prev.camera.x;
        const worldMouseY = prev.mouse.y - canvas.height / 2 + prev.camera.y;

        // Calculate ship movement
        const ship = { ...prev.ship };
        const dx = worldMouseX - ship.x;
        const dy = worldMouseY - ship.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Ship rotation (always look at mouse)
        ship.angle = Math.atan2(dy, dx);

        // Ship movement (speed based on distance to mouse)
        if (distance > 10) {
          const speedMultiplier = Math.min(distance / 200, 1);
          const targetVx = (dx / distance) * SHIP_MAX_SPEED * speedMultiplier;
          const targetVy = (dy / distance) * SHIP_MAX_SPEED * speedMultiplier;

          ship.vx += (targetVx - ship.vx) * SHIP_ACCELERATION;
          ship.vy += (targetVy - ship.vy) * SHIP_ACCELERATION;
        }

        // Apply friction
        ship.vx *= SHIP_FRICTION;
        ship.vy *= SHIP_FRICTION;

        // Update ship position with wrapping
        ship.x = wrapCoordinate(ship.x + ship.vx);
        ship.y = wrapCoordinate(ship.y + ship.vy);

        // Smooth camera follow
        const camera = { ...prev.camera };
        camera.x += (ship.x - camera.x) * 0.1;
        camera.y += (ship.y - camera.y) * 0.1;

        // Update projectiles
        const projectiles = prev.projectiles
          .map((proj) => ({
            ...proj,
            x: wrapCoordinate(proj.x + proj.vx),
            y: wrapCoordinate(proj.y + proj.vy),
            age: proj.age + 1,
          }))
          .filter((proj) => proj.age < 120); // Remove old projectiles

        return {
          ...prev,
          ship,
          camera,
          projectiles,
        };
      });

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [wrapCoordinate]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Render background star layers
      starLayers.current.slice(0, 4).forEach((layer, layerIndex) => {
        ctx.save();
        layer.stars.forEach((star) => {
          const parallaxX = (star.x - gameState.camera.x) * layer.parallaxSpeed;
          const parallaxY = (star.y - gameState.camera.y) * layer.parallaxSpeed;
          const screenX = centerX + parallaxX;
          const screenY = centerY + parallaxY;

          // Wrap stars around screen
          const wrappedScreenX =
            ((screenX % canvas.width) + canvas.width) % canvas.width;
          const wrappedScreenY =
            ((screenY % canvas.height) + canvas.height) % canvas.height;

          // Twinkling effect
          const twinkle = Math.sin(Date.now() * star.twinkleSpeed) * 0.3 + 0.7;
          ctx.globalAlpha = star.opacity * twinkle;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(wrappedScreenX, wrappedScreenY, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      });

      // Render center barrier (dashed circle)
      ctx.save();
      const barrierScreenX = centerX + (CENTER_X - gameState.camera.x);
      const barrierScreenY = centerY + (CENTER_Y - gameState.camera.y);
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(
        barrierScreenX,
        barrierScreenY,
        CENTER_BARRIER_RADIUS,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();

      // Render planets
      planets.current.forEach((planet) => {
        const planetScreenX = centerX + (planet.x - gameState.camera.x);
        const planetScreenY = centerY + (planet.y - gameState.camera.y);

        // Only render if on screen (with margin)
        if (
          planetScreenX > -100 &&
          planetScreenX < canvas.width + 100 &&
          planetScreenY > -100 &&
          planetScreenY < canvas.height + 100
        ) {
          // Planet glow
          ctx.save();
          const gradient = ctx.createRadialGradient(
            planetScreenX,
            planetScreenY,
            0,
            planetScreenX,
            planetScreenY,
            planet.size * 1.5,
          );
          gradient.addColorStop(0, planet.color + "80");
          gradient.addColorStop(1, planet.color + "00");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(
            planetScreenX,
            planetScreenY,
            planet.size * 1.5,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();

          // Planet body
          ctx.fillStyle = planet.color;
          ctx.beginPath();
          ctx.arc(planetScreenX, planetScreenY, planet.size, 0, Math.PI * 2);
          ctx.fill();

          // Planet highlight
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(
            planetScreenX - planet.size * 0.3,
            planetScreenY - planet.size * 0.3,
            planet.size * 0.4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        }
      });

      // Render projectiles
      gameState.projectiles.forEach((proj) => {
        const projScreenX = centerX + (proj.x - gameState.camera.x);
        const projScreenY = centerY + (proj.y - gameState.camera.y);

        ctx.save();
        ctx.globalAlpha = 1 - proj.age / 120;
        ctx.fillStyle = "#ffff00";
        ctx.shadowColor = "#ffff00";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(projScreenX, projScreenY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Render ship
      const shipScreenX = centerX + (gameState.ship.x - gameState.camera.x);
      const shipScreenY = centerY + (gameState.ship.y - gameState.camera.y);

      ctx.save();
      ctx.translate(shipScreenX, shipScreenY);
      ctx.rotate(gameState.ship.angle);

      // Ship glow
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#00aaff";
      ctx.shadowColor = "#00aaff";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-15, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Ship body
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#00aaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-15, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ship engines
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.arc(-12, -6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-12, 6, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Render foreground star layers
      starLayers.current.slice(4).forEach((layer) => {
        ctx.save();
        layer.stars.forEach((star) => {
          const parallaxX = (star.x - gameState.camera.x) * layer.parallaxSpeed;
          const parallaxY = (star.y - gameState.camera.y) * layer.parallaxSpeed;
          const screenX = centerX + parallaxX;
          const screenY = centerY + parallaxY;

          const wrappedScreenX =
            ((screenX % canvas.width) + canvas.width) % canvas.width;
          const wrappedScreenY =
            ((screenY % canvas.height) + canvas.height) % canvas.height;

          const twinkle = Math.sin(Date.now() * star.twinkleSpeed) * 0.3 + 0.7;
          ctx.globalAlpha = star.opacity * twinkle * 0.7;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(
            wrappedScreenX,
            wrappedScreenY,
            star.size * 1.2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        });
        ctx.restore();
      });

      requestAnimationFrame(render);
    };

    render();
  }, [gameState]);

  // Handle canvas clicks for planets
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Convert screen coordinates to world coordinates
      const worldClickX = clickX - centerX + gameState.camera.x;
      const worldClickY = clickY - centerY + gameState.camera.y;

      // Check if clicked on any planet
      planets.current.forEach((planet) => {
        const dx = worldClickX - planet.x;
        const dy = worldClickY - planet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= planet.size) {
          handlePlanetClick(planet);
        }
      });

      // Also shoot
      handleShoot(event);
    },
    [gameState.camera, handlePlanetClick, handleShoot],
  );

  return (
    <div className="w-full h-full bg-gray-900 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={handleCanvasClick}
        onTouchEnd={handleShoot}
        style={{ touchAction: "none" }}
      />

      {/* Game UI */}
      <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 p-2 rounded">
        <div>X: {Math.round(gameState.ship.x)}</div>
        <div>Y: {Math.round(gameState.ship.y)}</div>
        <div>
          Speed:{" "}
          {Math.round(
            Math.sqrt(gameState.ship.vx ** 2 + gameState.ship.vy ** 2) * 10,
          ) / 10}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 p-2 rounded text-sm">
        <div>• Move: Point mouse/finger</div>
        <div>• Shoot: Click/Tap</div>
        <div>• Planets: Click to interact</div>
      </div>
    </div>
  );
};
