import React, { useRef, useEffect, useState, useCallback } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  parallax: number;
  twinkle: number;
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
  warpTransition: {
    active: boolean;
    progress: number;
    direction: { x: number; y: number };
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
    warpTransition: {
      active: false,
      progress: 0,
      direction: { x: 0, y: 0 },
    },
  });

  // Initialize game objects once
  useEffect(() => {
    // Generate stars with different layers
    const stars: Star[] = [];

    // Background stars (far)
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 1 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        speed: Math.random() * 0.01 + 0.005,
        parallax: 0.2,
        twinkle: Math.random() * 100,
      });
    }

    // Mid stars
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 1.2 + 0.7,
        opacity: Math.random() * 0.4 + 0.4,
        speed: Math.random() * 0.015 + 0.01,
        parallax: 0.5,
        twinkle: Math.random() * 100,
      });
    }

    // Foreground stars (close)
    for (let i = 0; i < 30; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() * 1.5 + 1,
        opacity: Math.random() * 0.3 + 0.2,
        speed: Math.random() * 0.02 + 0.015,
        parallax: 1.3,
        twinkle: Math.random() * 100,
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
        const dx = clickX - planet.x;
        const dy = clickY - planet.y;
        if (Math.sqrt(dx * dx + dy * dy) < planet.size) {
          alert(`Explorando ${planet.name}!`);
        }
      });
    },
    [gameState],
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

        // Calculate world mouse position
        const worldMouseX = mouseRef.current.x - centerX + newState.camera.x;
        const worldMouseY = mouseRef.current.y - centerY + newState.camera.y;

        // Update ship
        const dx = worldMouseX - newState.ship.x;
        const dy = worldMouseY - newState.ship.y;
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

        // Handle seamless world wrapping with smooth transitions
        const WARP_BUFFER = 50; // Buffer zone before wrapping
        let needsWarp = false;
        let warpDirection = { x: 0, y: 0 };

        if (newState.ship.x < WARP_BUFFER) {
          needsWarp = true;
          warpDirection.x = 1; // Wrapping from left to right
        } else if (newState.ship.x > WORLD_SIZE - WARP_BUFFER) {
          needsWarp = true;
          warpDirection.x = -1; // Wrapping from right to left
        }

        if (newState.ship.y < WARP_BUFFER) {
          needsWarp = true;
          warpDirection.y = 1; // Wrapping from top to bottom
        } else if (newState.ship.y > WORLD_SIZE - WARP_BUFFER) {
          needsWarp = true;
          warpDirection.y = -1; // Wrapping from bottom to top
        }

        // Start warp transition if needed and not already active
        if (needsWarp && !newState.warpTransition.active) {
          newState.warpTransition = {
            active: true,
            progress: 0,
            direction: warpDirection,
          };
        }

        // Handle active warp transition
        if (newState.warpTransition.active) {
          newState.warpTransition.progress += 0.1; // Transition speed

          if (newState.warpTransition.progress >= 1) {
            // Complete the warp
            if (newState.warpTransition.direction.x !== 0) {
              if (newState.ship.x < WARP_BUFFER) {
                newState.ship.x += WORLD_SIZE - WARP_BUFFER * 2;
              } else if (newState.ship.x > WORLD_SIZE - WARP_BUFFER) {
                newState.ship.x -= WORLD_SIZE - WARP_BUFFER * 2;
              }
            }

            if (newState.warpTransition.direction.y !== 0) {
              if (newState.ship.y < WARP_BUFFER) {
                newState.ship.y += WORLD_SIZE - WARP_BUFFER * 2;
              } else if (newState.ship.y > WORLD_SIZE - WARP_BUFFER) {
                newState.ship.y -= WORLD_SIZE - WARP_BUFFER * 2;
              }
            }

            // Reset transition
            newState.warpTransition = {
              active: false,
              progress: 0,
              direction: { x: 0, y: 0 },
            };
          }
        }

        // Fallback hard wrap for edge cases
        if (newState.ship.x < 0) newState.ship.x += WORLD_SIZE;
        if (newState.ship.x > WORLD_SIZE) newState.ship.x -= WORLD_SIZE;
        if (newState.ship.y < 0) newState.ship.y += WORLD_SIZE;
        if (newState.ship.y > WORLD_SIZE) newState.ship.y -= WORLD_SIZE;

        // Update camera
        newState.camera.x += (newState.ship.x - newState.camera.x) * 0.08;
        newState.camera.y += (newState.ship.y - newState.camera.y) * 0.08;

        return newState;
      });

      // Update projectiles
      projectilesRef.current = projectilesRef.current
        .map((proj) => ({
          ...proj,
          x: proj.x + proj.vx,
          y: proj.y + proj.vy,
          life: proj.life - 1,
        }))
        .filter((proj) => proj.life > 0);

      // Clear canvas
      ctx.fillStyle = "#0a0a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render background stars
      ctx.fillStyle = "#ffffff";
      starsRef.current.forEach((star, i) => {
        if (star.parallax < 1) {
          // Background stars only
          const parallaxX = (star.x - gameState.camera.x) * star.parallax;
          const parallaxY = (star.y - gameState.camera.y) * star.parallax;
          const screenX = centerX + parallaxX;
          const screenY = centerY + parallaxY;

          // Only render stars that are on screen (with margin)
          if (
            screenX > -50 &&
            screenX < canvas.width + 50 &&
            screenY > -50 &&
            screenY < canvas.height + 50
          ) {
            // Subtle twinkling
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

      // Render barrier (hidden during warp transition)
      if (!gameState.warpTransition.active) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(
          centerX + (CENTER_X - gameState.camera.x),
          centerY + (CENTER_Y - gameState.camera.y),
          BARRIER_RADIUS,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Render planets
      planetsRef.current.forEach((planet) => {
        const screenX = centerX + (planet.x - gameState.camera.x);
        const screenY = centerY + (planet.y - gameState.camera.y);

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
        const screenX = centerX + (proj.x - gameState.camera.x);
        const screenY = centerY + (proj.y - gameState.camera.y);
        ctx.save();
        ctx.globalAlpha = proj.life / 80;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Render ship
      const shipScreenX = centerX + (gameState.ship.x - gameState.camera.x);
      const shipScreenY = centerY + (gameState.ship.y - gameState.camera.y);

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
          // Foreground stars only
          const parallaxX = (star.x - gameState.camera.x) * star.parallax;
          const parallaxY = (star.y - gameState.camera.y) * star.parallax;
          const screenX = centerX + parallaxX;
          const screenY = centerY + parallaxY;

          // Only render stars that are on screen
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
  }, [gameState]);

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
