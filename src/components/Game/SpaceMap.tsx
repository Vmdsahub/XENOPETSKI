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
  type: "normal" | "bright" | "giant";
  drift: { x: number; y: number };
  pulse: number;
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

// Pre-render buffer size
const RENDER_BUFFER = 200;

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

  // FPS tracking
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({
    frameCount: 0,
    lastTime: 0,
    frameTimes: [] as number[],
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

  // Helper function to draw a glowing star without cross shapes
  const drawGlowingStar = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      color: string,
      intensity: number,
      type: "normal" | "bright" | "giant",
    ) => {
      // Convert hex color to rgba for proper alpha handling
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      // Main star core with soft glow
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Enhanced glow effect for larger/brighter stars
      if (size > 0.8 || type === "bright" || type === "giant") {
        const glowRadius = type === "giant" ? size * 4 : size * 2.5;
        const glowIntensity =
          type === "giant" ? 0.9 : type === "bright" ? 0.7 : 0.5;

        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, hexToRgba(color, intensity * glowIntensity));
        gradient.addColorStop(0.6, hexToRgba(color, intensity * 0.3));
        gradient.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Diamond sparkle effect for bright/giant stars (no crosses)
      if (type === "bright" || type === "giant") {
        const sparkleSize = size * (type === "giant" ? 2.5 : 1.8);
        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = intensity * 0.4;
        ctx.fillStyle = hexToRgba(color, 0.6);

        // Draw diamond shape instead of cross
        ctx.beginPath();
        ctx.moveTo(x, y - sparkleSize);
        ctx.lineTo(x + sparkleSize * 0.3, y);
        ctx.lineTo(x, y + sparkleSize);
        ctx.lineTo(x - sparkleSize * 0.3, y);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = originalAlpha;
      }
    },
    [],
  );

  // Generate dense star field with multiple parallax layers
  const generateRichStarField = useCallback(() => {
    const stars: Star[] = [];
    const starColors = [
      "#ffffff",
      "#ffe4b5",
      "#ffd700",
      "#ffeb3b",
      "#fff8e1", // Warm whites and yellows
      "#87ceeb",
      "#b0e0e6",
      "#add8e6",
      "#e1f5fe",
      "#f3e5f5", // Cool blues and whites
      "#ff69b4",
      "#ffb6c1",
      "#ffc0cb",
      "#ffe4e1", // Pinks
      "#98fb98",
      "#90ee90",
      "#f0fff0", // Greens
      "#dda0dd",
      "#e6e6fa",
      "#f8f8ff", // Purples
    ];

    // Ultra distant background layer (depth 0.01-0.03) - enhanced parallax
    for (let i = 0; i < 600; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 0.3 + Math.random() * 0.4,
        opacity: 0.15 + Math.random() * 0.2,
        speed: Math.random() * 0.004 + 0.001,
        parallax: 0.01 + Math.random() * 0.02, // More pronounced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.9
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.008, // More cosmic dust movement
          y: (Math.random() - 0.5) * 0.008,
        },
        pulse: Math.random() * 100,
      });
    }

    // Very distant layer (depth 0.03-0.08) - enhanced parallax
    for (let i = 0; i < 500; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 0.4 + Math.random() * 0.5,
        opacity: 0.2 + Math.random() * 0.25,
        speed: Math.random() * 0.006 + 0.002,
        parallax: 0.03 + Math.random() * 0.05, // Enhanced parallax difference
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.85
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.007, // More cosmic dust movement
          y: (Math.random() - 0.5) * 0.007,
        },
        pulse: Math.random() * 100,
      });
    }

    // Far distant layer (depth 0.08-0.18)
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 0.5 + Math.random() * 0.6,
        opacity: 0.25 + Math.random() * 0.3,
        speed: Math.random() * 0.008 + 0.003,
        parallax: 0.08 + Math.random() * 0.1, // Enhanced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.8
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.05 ? "bright" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.006,
          y: (Math.random() - 0.5) * 0.006,
        },
        pulse: Math.random() * 100,
      });
    }

    // Distant layer (depth 0.18-0.35)
    for (let i = 0; i < 350; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 0.6 + Math.random() * 0.8,
        opacity: 0.3 + Math.random() * 0.35,
        speed: Math.random() * 0.01 + 0.004,
        parallax: 0.18 + Math.random() * 0.17, // Enhanced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.75
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.08 ? "bright" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.005,
          y: (Math.random() - 0.5) * 0.005,
        },
        pulse: Math.random() * 100,
      });
    }

    // Mid-distant layer (depth 0.35-0.55)
    for (let i = 0; i < 300; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 0.7 + Math.random() * 1.0,
        opacity: 0.35 + Math.random() * 0.4,
        speed: Math.random() * 0.012 + 0.005,
        parallax: 0.35 + Math.random() * 0.2, // Enhanced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.7
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.12 ? "bright" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.004,
          y: (Math.random() - 0.5) * 0.004,
        },
        pulse: Math.random() * 100,
      });
    }

    // Middle layer (depth 0.55-0.75)
    for (let i = 0; i < 250; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 0.8 + Math.random() * 1.2,
        opacity: 0.4 + Math.random() * 0.4,
        speed: Math.random() * 0.015 + 0.006,
        parallax: 0.55 + Math.random() * 0.2, // Enhanced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.65
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.15 ? "bright" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0035,
          y: (Math.random() - 0.5) * 0.0035,
        },
        pulse: Math.random() * 100,
      });
    }

    // Close layer (depth 0.75-0.95)
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 1.0 + Math.random() * 1.5,
        opacity: 0.45 + Math.random() * 0.35,
        speed: Math.random() * 0.018 + 0.008,
        parallax: 0.75 + Math.random() * 0.2, // Enhanced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.6
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.2 ? "bright" : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.003,
          y: (Math.random() - 0.5) * 0.003,
        },
        pulse: Math.random() * 100,
      });
    }

    // Near layer (depth 0.95-1.15)
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 1.2 + Math.random() * 1.8,
        opacity: 0.5 + Math.random() * 0.3,
        speed: Math.random() * 0.022 + 0.01,
        parallax: 0.95 + Math.random() * 0.2, // Enhanced parallax
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.55
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type:
          Math.random() < 0.25
            ? "bright"
            : Math.random() < 0.05
              ? "giant"
              : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0025,
          y: (Math.random() - 0.5) * 0.0025,
        },
        pulse: Math.random() * 100,
      });
    }

    // Foreground layer (depth 1.15-1.45) - closest layer
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 1.5 + Math.random() * 2.0,
        opacity: 0.3 + Math.random() * 0.25,
        speed: Math.random() * 0.028 + 0.012,
        parallax: 1.15 + Math.random() * 0.3, // Maximum parallax effect
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.5
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type:
          Math.random() < 0.3
            ? "bright"
            : Math.random() < 0.1
              ? "giant"
              : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.002,
          y: (Math.random() - 0.5) * 0.002,
        },
        pulse: Math.random() * 100,
      });
    }

    // Very close cosmic dust layer (depth 1.45-1.8)
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 2.0 + Math.random() * 2.5,
        opacity: 0.15 + Math.random() * 0.15, // More subtle for dust effect
        speed: Math.random() * 0.035 + 0.015,
        parallax: 1.45 + Math.random() * 0.35, // Maximum parallax movement
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.4
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type:
          Math.random() < 0.4
            ? "bright"
            : Math.random() < 0.15
              ? "giant"
              : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0015, // Enhanced cosmic dust drift
          y: (Math.random() - 0.5) * 0.0015,
        },
        pulse: Math.random() * 100,
      });
    }

    starsRef.current = stars;
  }, []);

  // Initialize game objects once
  useEffect(() => {
    generateRichStarField();

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
  }, [generateRichStarField]);

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

  // Optimized game loop with pre-rendering considerations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 16.67);

      // Calculate FPS
      if (fpsRef.current.lastTime > 0) {
        const frameTime = currentTime - fpsRef.current.lastTime;
        fpsRef.current.frameTimes.push(frameTime);

        // Keep only last 60 frames for average
        if (fpsRef.current.frameTimes.length > 60) {
          fpsRef.current.frameTimes.shift();
        }

        // Update FPS every 30 frames
        fpsRef.current.frameCount++;
        if (fpsRef.current.frameCount >= 30) {
          const avgFrameTime =
            fpsRef.current.frameTimes.reduce((a, b) => a + b, 0) /
            fpsRef.current.frameTimes.length;
          const currentFps = Math.round(1000 / avgFrameTime);
          setFps(currentFps);
          fpsRef.current.frameCount = 0;
        }
      }

      fpsRef.current.lastTime = currentTime;
      lastTime = currentTime;

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

        const worldMouseX = mouseRef.current.x - centerX + newState.camera.x;
        const worldMouseY = mouseRef.current.y - centerY + newState.camera.y;

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

        newState.ship.x = normalizeCoord(newState.ship.x);
        newState.ship.y = normalizeCoord(newState.ship.y);

        const cameraFollowSpeed = 0.08;
        const deltaX = getWrappedDistance(newState.ship.x, newState.camera.x);
        const deltaY = getWrappedDistance(newState.ship.y, newState.camera.y);

        newState.camera.x += deltaX * cameraFollowSpeed;
        newState.camera.y += deltaY * cameraFollowSpeed;

        newState.camera.x = normalizeCoord(newState.camera.x);
        newState.camera.y = normalizeCoord(newState.camera.y);

        return newState;
      });

      // Update stars with optimized loop
      const stars = starsRef.current;
      for (let i = 0, len = stars.length; i < len; i++) {
        const star = stars[i];
        star.x = normalizeCoord(star.x + star.drift.x);
        star.y = normalizeCoord(star.y + star.drift.y);
        star.twinkle += star.speed;
        star.pulse += star.speed * 0.8;
      }

      // Update projectiles
      projectilesRef.current = projectilesRef.current
        .map((proj) => ({
          ...proj,
          x: normalizeCoord(proj.x + proj.vx),
          y: normalizeCoord(proj.y + proj.vy),
          life: proj.life - 1,
        }))
        .filter((proj) => proj.life > 0);

      // Clear canvas with deep space gradient
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(canvas.width, canvas.height) * 0.8,
      );
      gradient.addColorStop(0, "#0a0a2e");
      gradient.addColorStop(0.3, "#16213e");
      gradient.addColorStop(0.7, "#0e1b2e");
      gradient.addColorStop(1, "#080820");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render stars with extended viewport for smooth scrolling and batching
      const renderViewport = {
        left: -RENDER_BUFFER,
        right: canvas.width + RENDER_BUFFER,
        top: -RENDER_BUFFER,
        bottom: canvas.height + RENDER_BUFFER,
      };

      // Batch stars by type for optimized rendering
      const starBatches = { normal: [], bright: [], giant: [] };
      const starArray = starsRef.current;

      for (let i = 0, len = starArray.length; i < len; i++) {
        const star = starArray[i];
        const wrappedDeltaX = getWrappedDistance(star.x, gameState.camera.x);
        const wrappedDeltaY = getWrappedDistance(star.y, gameState.camera.y);

        const parallaxX = wrappedDeltaX * star.parallax;
        const parallaxY = wrappedDeltaY * star.parallax;
        const screenX = centerX + parallaxX;
        const screenY = centerY + parallaxY;

        // Extended viewport check for smooth rendering
        if (
          screenX > renderViewport.left &&
          screenX < renderViewport.right &&
          screenY > renderViewport.top &&
          screenY < renderViewport.bottom
        ) {
          // Enhanced twinkling based on star type
          const twinkleAlpha = Math.sin(star.twinkle) * 0.4 + 0.6;
          const pulseSize =
            star.type === "giant" ? Math.sin(star.pulse * 0.5) * 0.3 + 1 : 1;

          let finalAlpha = star.opacity * twinkleAlpha;
          let finalSize = star.size * pulseSize;

          // Type-based enhancements
          if (star.type === "bright") {
            finalAlpha *= 1.4;
            finalSize *= 1.2;
          } else if (star.type === "giant") {
            finalAlpha *= 1.6;
            finalSize *= 1.5;
          }

          starBatches[star.type].push({
            x: Math.round(screenX),
            y: Math.round(screenY),
            size: finalSize,
            alpha: finalAlpha,
            color: star.color,
            type: star.type,
          });
        }
      }

      // Render batched stars (normal first, then bright, then giant for layering)
      Object.keys(starBatches).forEach((type) => {
        const batch = starBatches[type];
        for (let i = 0, len = batch.length; i < len; i++) {
          const star = batch[i];
          ctx.save();
          ctx.globalAlpha = star.alpha;
          drawGlowingStar(
            ctx,
            star.x,
            star.y,
            star.size,
            star.color,
            star.alpha,
            star.type,
          );
          ctx.restore();
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
          ctx.globalAlpha = 1;
          ctx.fillStyle = planet.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, planet.size, 0, Math.PI * 2);
          ctx.fill();

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

      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.arc(-8, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-8, 4, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.globalAlpha = 1;

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, getWrappedDistance, normalizeCoord, drawGlowingStar]);

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
        <div
          className={
            fps < 30
              ? "text-red-400"
              : fps < 50
                ? "text-yellow-400"
                : "text-green-400"
          }
        >
          FPS: {fps}
        </div>
      </div>

      <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-70 p-2 rounded">
        <div>• Mouse: Mover nave</div>
        <div>• Click: Atirar/Planeta</div>
      </div>
    </div>
  );
};
