import React, { useRef, useEffect, useState, useCallback } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  parallax: number;
  twinkle: number;
  color: string;
  type: "normal" | "colored" | "bright";
  drift: { x: number; y: number };
  pulse: number;
  sparkle: number;
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
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
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
}

const WORLD_SIZE = 10000;
const SHIP_MAX_SPEED = 2;
const FRICTION = 0.88;
const CENTER_X = WORLD_SIZE / 2;
const CENTER_Y = WORLD_SIZE / 2;
const BARRIER_RADIUS = 600;

export const SpaceMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0 });
  const starsRef = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);

  const [gameState, setGameState] = useState<GameState>({
    ship: {
      x: CENTER_X,
      y: CENTER_Y + 200,
      angle: 0,
      vx: 0,
      vy: 0,
    },
    camera: {
      x: CENTER_X,
      y: CENTER_Y + 200,
    },
  });

  // Helper function for seamless wrapping distance calculation
  const getWrappedDistance = useCallback(
    (coord: number, cameraCoord: number) => {
      let delta = coord - cameraCoord;
      if (delta > WORLD_SIZE / 2) delta -= WORLD_SIZE;
      else if (delta < -WORLD_SIZE / 2) delta += WORLD_SIZE;
      return delta;
    },
    [],
  );

  // Helper function to normalize coordinates within world bounds
  const normalizeCoord = useCallback((coord: number) => {
    return ((coord % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;
  }, []);

  // Initialize game objects once
  useEffect(() => {
    // Generate stars with different layers and enhanced cosmic effects
    const stars: Star[] = [];
    const starColors = [
      "#ffffff",
      "#ffe4b5",
      "#ffd700",
      "#87ceeb",
      "#ff69b4",
      "#98fb98",
      "#dda0dd",
      "#f0e68c",
    ];

    // Distant background stars (cosmic dust)
    for (let i = 0; i < 200; i++) {
      const isColored = Math.random() < 0.15; // 15% chance of colored star
      const isBright = Math.random() < 0.1; // 10% chance of bright star

      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 0.8 + 0.3,
        opacity: Math.random() * 0.4 + 0.2,
        speed: Math.random() * 0.008 + 0.003,
        parallax: 0.1,
        twinkle: Math.random() * 100,
        color: isColored
          ? starColors[Math.floor(Math.random() * starColors.length)]
          : "#ffffff",
        type: isBright ? "bright" : isColored ? "colored" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.002,
          y: (Math.random() - 0.5) * 0.002,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
      });
    }

    // Mid-distance stars
    for (let i = 0; i < 150; i++) {
      const isColored = Math.random() < 0.2; // 20% chance of colored star
      const isBright = Math.random() < 0.15; // 15% chance of bright star

      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 1.2 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        speed: Math.random() * 0.012 + 0.008,
        parallax: 0.4,
        twinkle: Math.random() * 100,
        color: isColored
          ? starColors[Math.floor(Math.random() * starColors.length)]
          : "#ffffff",
        type: isBright ? "bright" : isColored ? "colored" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.001,
          y: (Math.random() - 0.5) * 0.001,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
      });
    }

    // Close foreground stars
    for (let i = 0; i < 80; i++) {
      const isColored = Math.random() < 0.25; // 25% chance of colored star
      const isBright = Math.random() < 0.2; // 20% chance of bright star

      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 1.8 + 0.8,
        opacity: Math.random() * 0.4 + 0.25,
        speed: Math.random() * 0.018 + 0.012,
        parallax: 1.0,
        twinkle: Math.random() * 100,
        color: isColored
          ? starColors[Math.floor(Math.random() * starColors.length)]
          : "#ffffff",
        type: isBright ? "bright" : isColored ? "colored" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0008,
          y: (Math.random() - 0.5) * 0.0008,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
      });
    }

    // Very close bright stars
    for (let i = 0; i < 40; i++) {
      const isColored = Math.random() < 0.3; // 30% chance of colored star
      const isBright = Math.random() < 0.4; // 40% chance of bright star

      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 2.2 + 1.2,
        opacity: Math.random() * 0.3 + 0.15,
        speed: Math.random() * 0.025 + 0.015,
        parallax: 1.5,
        twinkle: Math.random() * 100,
        color: isColored
          ? starColors[Math.floor(Math.random() * starColors.length)]
          : "#ffffff",
        type: isBright ? "bright" : isColored ? "colored" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0005,
          y: (Math.random() - 0.5) * 0.0005,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
      });
    }

    starsRef.current = stars;

    // Generate planets
    const planets: Planet[] = [];
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#ffeaa7",
      "#dda0dd",
    ];

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 250;
      planets.push({
        id: `planet-${i}`,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
        size: 30 + Math.random() * 15,
        color: colors[i],
        name: `Planet ${i + 1}`,
      });
    }

    planetsRef.current = planets;
  }, []);

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  // Handle shooting
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const newProjectile: Projectile = {
        x: gameState.ship.x,
        y: gameState.ship.y,
        vx: Math.cos(gameState.ship.angle) * 10,
        vy: Math.sin(gameState.ship.angle) * 10,
        life: 80,
      };
      projectilesRef.current.push(newProjectile);

      // Check planet clicks
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX =
        e.clientX - rect.left - canvas.width / 2 + gameState.camera.x;
      const clickY =
        e.clientY - rect.top - canvas.height / 2 + gameState.camera.y;

      planetsRef.current.forEach((planet) => {
        const dx = getWrappedDistance(planet.x, clickX);
        const dy = getWrappedDistance(planet.y, clickY);
        if (Math.sqrt(dx * dx + dy * dy) < planet.size) {
          alert(`Explorando ${planet.name}!`);
        }
      });
    },
    [gameState, getWrappedDistance],
  );

  // Optimized game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 16.67); // Cap at 60fps
      lastTime = currentTime;

      // Resize canvas if needed
      if (
        canvas.width !== canvas.offsetWidth ||
        canvas.height !== canvas.offsetHeight
      ) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Update game state
      setGameState((prevState) => {
        const newState = { ...prevState };

        // Calculate world mouse position using wrapped distance
        const worldMouseX = mouseRef.current.x - centerX + newState.camera.x;
        const worldMouseY = mouseRef.current.y - centerY + newState.camera.y;

        // Update ship
        const dx = getWrappedDistance(worldMouseX, newState.ship.x);
        const dy = getWrappedDistance(worldMouseY, newState.ship.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        newState.ship.angle = Math.atan2(dy, dx);

        if (distance > 10) {
          const speedMultiplier = Math.min(distance / 300, 1);
          const targetSpeed = SHIP_MAX_SPEED * speedMultiplier;
          newState.ship.vx += (dx / distance) * targetSpeed * 0.04;
          newState.ship.vy += (dy / distance) * targetSpeed * 0.04;
        }

        newState.ship.vx *= FRICTION;
        newState.ship.vy *= FRICTION;

        newState.ship.x += newState.ship.vx;
        newState.ship.y += newState.ship.vy;

        // Normalize ship position for seamless wrapping
        newState.ship.x = normalizeCoord(newState.ship.x);
        newState.ship.y = normalizeCoord(newState.ship.y);

        // Update camera with seamless wrapping awareness
        const cameraFollowSpeed = 0.08;

        const deltaX = getWrappedDistance(newState.ship.x, newState.camera.x);
        const deltaY = getWrappedDistance(newState.ship.y, newState.camera.y);

        newState.camera.x += deltaX * cameraFollowSpeed;
        newState.camera.y += deltaY * cameraFollowSpeed;

        // Normalize camera position
        newState.camera.x = normalizeCoord(newState.camera.x);
        newState.camera.y = normalizeCoord(newState.camera.y);

        return newState;
      });

      // Update projectiles
      projectilesRef.current = projectilesRef.current
        .map((proj) => ({
          ...proj,
          x: normalizeCoord(proj.x + proj.vx),
          y: normalizeCoord(proj.y + proj.vy),
          life: proj.life - 1,
        }))
        .filter((proj) => proj.life > 0);

      // Clear canvas
      ctx.fillStyle = "#0a0a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render background stars
      ctx.fillStyle = "#ffffff";
      starsRef.current.forEach((star) => {
        if (star.parallax < 1) {
          const wrappedDeltaX = getWrappedDistance(star.x, gameState.camera.x);
          const wrappedDeltaY = getWrappedDistance(star.y, gameState.camera.y);

          const parallaxX = wrappedDeltaX * star.parallax;
          const parallaxY = wrappedDeltaY * star.parallax;
          const screenX = centerX + parallaxX;
          const screenY = centerY + parallaxY;

          if (
            screenX > -50 &&
            screenX < canvas.width + 50 &&
            screenY > -50 &&
            screenY < canvas.height + 50
          ) {
            star.twinkle += star.speed;
            const alpha = star.opacity * (Math.sin(star.twinkle) * 0.1 + 0.9);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(
              Math.round(screenX),
              Math.round(screenY),
              star.size,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.restore();
          }
        }
      });

      // Render barrier circle
      const barrierWrappedDeltaX = getWrappedDistance(
        CENTER_X,
        gameState.camera.x,
      );
      const barrierWrappedDeltaY = getWrappedDistance(
        CENTER_Y,
        gameState.camera.y,
      );
      const barrierScreenX = centerX + barrierWrappedDeltaX;
      const barrierScreenY = centerY + barrierWrappedDeltaY;

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(barrierScreenX, barrierScreenY, BARRIER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Render planets
      planetsRef.current.forEach((planet) => {
        const wrappedDeltaX = getWrappedDistance(planet.x, gameState.camera.x);
        const wrappedDeltaY = getWrappedDistance(planet.y, gameState.camera.y);

        const screenX = centerX + wrappedDeltaX;
        const screenY = centerY + wrappedDeltaY;

        if (
          screenX > -100 &&
          screenX < canvas.width + 100 &&
          screenY > -100 &&
          screenY < canvas.height + 100
        ) {
          // Planet body
          ctx.globalAlpha = 1;
          ctx.fillStyle = planet.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, planet.size, 0, Math.PI * 2);
          ctx.fill();

          // Simple highlight
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(
            screenX - planet.size * 0.2,
            screenY - planet.size * 0.2,
            planet.size * 0.3,
            0,
            Math.PI * 2,
          );
          ctx.fill();

          // Reset alpha
          ctx.globalAlpha = 1;
        }
      });

      // Render projectiles
      ctx.fillStyle = "#ffff00";
      projectilesRef.current.forEach((proj) => {
        const wrappedDeltaX = getWrappedDistance(proj.x, gameState.camera.x);
        const wrappedDeltaY = getWrappedDistance(proj.y, gameState.camera.y);
        const screenX = centerX + wrappedDeltaX;
        const screenY = centerY + wrappedDeltaY;
        ctx.save();
        ctx.globalAlpha = proj.life / 80;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Render ship
      const shipWrappedDeltaX = getWrappedDistance(
        gameState.ship.x,
        gameState.camera.x,
      );
      const shipWrappedDeltaY = getWrappedDistance(
        gameState.ship.y,
        gameState.camera.y,
      );
      const shipScreenX = centerX + shipWrappedDeltaX;
      const shipScreenY = centerY + shipWrappedDeltaY;

      ctx.save();
      ctx.translate(shipScreenX, shipScreenY);
      ctx.rotate(gameState.ship.angle);
      ctx.globalAlpha = 1;

      // Ship body
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#00aaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Engines
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.arc(-8, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-8, 4, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Render foreground stars
      ctx.fillStyle = "#ffffff";
      starsRef.current.forEach((star) => {
        if (star.parallax >= 1) {
          const wrappedDeltaX = getWrappedDistance(star.x, gameState.camera.x);
          const wrappedDeltaY = getWrappedDistance(star.y, gameState.camera.y);

          const parallaxX = wrappedDeltaX * star.parallax;
          const parallaxY = wrappedDeltaY * star.parallax;
          const screenX = centerX + parallaxX;
          const screenY = centerY + parallaxY;

          if (
            screenX > -30 &&
            screenX < canvas.width + 30 &&
            screenY > -30 &&
            screenY < canvas.height + 30
          ) {
            star.twinkle += star.speed;
            const alpha = star.opacity * (Math.sin(star.twinkle) * 0.1 + 0.9);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(
              Math.round(screenX),
              Math.round(screenY),
              star.size,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.restore();
          }
        }
      });

      // Final reset to ensure clean state
      ctx.globalAlpha = 1;

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, getWrappedDistance, normalizeCoord]);

  return (
    <div className="w-full h-full relative bg-gray-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      <div className="absolute top-2 left-2 text-white text-xs bg-black bg-opacity-70 p-2 rounded">
        <div>X: {Math.round(gameState.ship.x)}</div>
        <div>Y: {Math.round(gameState.ship.y)}</div>
        <div>
          Vel:{" "}
          {Math.round(
            Math.sqrt(gameState.ship.vx ** 2 + gameState.ship.vy ** 2) * 10,
          ) / 10}
        </div>
      </div>

      <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-70 p-2 rounded">
        <div>• Mouse: Mover nave</div>
        <div>• Click: Atirar/Planeta</div>
      </div>
    </div>
  );
};
