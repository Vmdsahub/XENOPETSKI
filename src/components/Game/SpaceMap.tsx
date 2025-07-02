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
  type: "normal" | "colored" | "bright" | "giant" | "binary" | "pulsar";
  drift: { x: number; y: number };
  pulse: number;
  sparkle: number;
  constellation?: string;
}

interface Nebula {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  rotation: number;
  type: "emission" | "reflection" | "dark";
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
  const nebulaeRef = useRef<Nebula[]>([]);
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

  // Helper function to draw a star shape instead of circle
  const drawStar = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      spikes: number = 4,
    ) => {
      const outerRadius = size;
      const innerRadius = size * 0.4;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(x, y - outerRadius);

      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(
          x + Math.cos(rot) * outerRadius,
          y + Math.sin(rot) * outerRadius,
        );
        rot += step;
        ctx.lineTo(
          x + Math.cos(rot) * innerRadius,
          y + Math.sin(rot) * innerRadius,
        );
        rot += step;
      }

      ctx.lineTo(x, y - outerRadius);
      ctx.closePath();
    },
    [],
  );

  // Generate realistic galactic distribution
  const generateGalacticField = useCallback(() => {
    const stars: Star[] = [];
    const nebulae: Nebula[] = [];

    // Define galactic center and arms
    const galacticCenter = { x: CENTER_X, y: CENTER_Y };
    const armCount = 4;
    const armLength = WORLD_SIZE * 0.4;

    // Color palettes for different regions
    const coreColors = ["#ffeb3b", "#ffc107", "#ff9800", "#ff5722"];
    const armColors = ["#2196f3", "#03a9f4", "#00bcd4", "#009688"];
    const haloColors = ["#e1f5fe", "#f3e5f5", "#fff3e0", "#ffffff"];
    const nebulaColors = [
      "#e91e63",
      "#9c27b0",
      "#673ab7",
      "#3f51b5",
      "#2196f3",
      "#00bcd4",
      "#4caf50",
      "#8bc34a",
    ];

    // Generate nebulae first (background)
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * WORLD_SIZE * 0.6;
      const nebulaType =
        Math.random() < 0.6
          ? "emission"
          : Math.random() < 0.8
            ? "reflection"
            : "dark";

      nebulae.push({
        x: galacticCenter.x + Math.cos(angle) * distance,
        y: galacticCenter.y + Math.sin(angle) * distance,
        size: 300 + Math.random() * 800,
        color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
        opacity: 0.05 + Math.random() * 0.1,
        rotation: Math.random() * Math.PI * 2,
        type: nebulaType,
      });
    }

    // Generate galactic core (dense, bright stars)
    for (let i = 0; i < 1200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * Math.random() * 800; // Concentrated in center

      const star: Star = {
        x: galacticCenter.x + Math.cos(angle) * distance,
        y: galacticCenter.y + Math.sin(angle) * distance,
        size: 0.8 + Math.random() * 2.5,
        opacity: 0.4 + Math.random() * 0.6,
        speed: Math.random() * 0.01 + 0.005,
        parallax: 0.1 + Math.random() * 0.3,
        twinkle: Math.random() * 100,
        color: coreColors[Math.floor(Math.random() * coreColors.length)],
        type:
          Math.random() < 0.3
            ? "giant"
            : Math.random() < 0.1
              ? "binary"
              : "bright",
        drift: {
          x: (Math.random() - 0.5) * 0.001,
          y: (Math.random() - 0.5) * 0.001,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
        constellation: "Core",
      };

      stars.push(star);
    }

    // Generate spiral arms
    for (let arm = 0; arm < armCount; arm++) {
      const armAngle = (arm / armCount) * Math.PI * 2;

      // Each arm has different density regions
      for (let segment = 0; segment < 8; segment++) {
        const segmentLength = armLength / 8;
        const segmentDistance = segment * segmentLength;
        const spiralAngle =
          armAngle + (segmentDistance / armLength) * Math.PI * 1.5;

        const armX = galacticCenter.x + Math.cos(spiralAngle) * segmentDistance;
        const armY = galacticCenter.y + Math.sin(spiralAngle) * segmentDistance;

        // Dense star clusters along arms
        const clusterSize = 200 - segment * 20; // Smaller clusters further out
        const starCount = 150 - segment * 15; // Fewer stars further out

        for (let i = 0; i < starCount; i++) {
          const clusterAngle = Math.random() * Math.PI * 2;
          const clusterRadius = Math.random() * clusterSize;

          const star: Star = {
            x: normalizeCoord(armX + Math.cos(clusterAngle) * clusterRadius),
            y: normalizeCoord(armY + Math.sin(clusterAngle) * clusterRadius),
            size: 0.5 + Math.random() * 2,
            opacity: 0.3 + Math.random() * 0.5,
            speed: Math.random() * 0.015 + 0.008,
            parallax: 0.2 + Math.random() * 0.6,
            twinkle: Math.random() * 100,
            color:
              Math.random() < 0.7
                ? "#ffffff"
                : armColors[Math.floor(Math.random() * armColors.length)],
            type:
              Math.random() < 0.05
                ? "giant"
                : Math.random() < 0.02
                  ? "pulsar"
                  : "normal",
            drift: {
              x: (Math.random() - 0.5) * 0.0008,
              y: (Math.random() - 0.5) * 0.0008,
            },
            pulse: Math.random() * 100,
            sparkle: Math.random() * 100,
            constellation: `Arm-${arm + 1}`,
          };

          stars.push(star);
        }
      }
    }

    // Generate star-forming regions (bright clusters)
    for (let i = 0; i < 12; i++) {
      const regionX = Math.random() * WORLD_SIZE;
      const regionY = Math.random() * WORLD_SIZE;
      const regionSize = 100 + Math.random() * 200;

      // Hot young stars
      for (let j = 0; j < 80; j++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * regionSize;

        const star: Star = {
          x: normalizeCoord(regionX + Math.cos(angle) * distance),
          y: normalizeCoord(regionY + Math.sin(angle) * distance),
          size: 1 + Math.random() * 3,
          opacity: 0.6 + Math.random() * 0.4,
          speed: Math.random() * 0.02 + 0.01,
          parallax: 0.5 + Math.random() * 0.8,
          twinkle: Math.random() * 100,
          color: ["#87ceeb", "#b0e0e6", "#add8e6", "#ffffff"][
            Math.floor(Math.random() * 4)
          ],
          type: Math.random() < 0.4 ? "bright" : "giant",
          drift: {
            x: (Math.random() - 0.5) * 0.0005,
            y: (Math.random() - 0.5) * 0.0005,
          },
          pulse: Math.random() * 100,
          sparkle: Math.random() * 100,
          constellation: `Cluster-${i + 1}`,
        };

        stars.push(star);
      }
    }

    // Generate globular clusters (old stars)
    for (let i = 0; i < 8; i++) {
      const clusterAngle = Math.random() * Math.PI * 2;
      const clusterDistance =
        WORLD_SIZE * 0.3 + Math.random() * WORLD_SIZE * 0.2;
      const clusterX =
        galacticCenter.x + Math.cos(clusterAngle) * clusterDistance;
      const clusterY =
        galacticCenter.y + Math.sin(clusterAngle) * clusterDistance;

      for (let j = 0; j < 120; j++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * Math.random() * 150; // Dense center

        const star: Star = {
          x: normalizeCoord(clusterX + Math.cos(angle) * distance),
          y: normalizeCoord(clusterY + Math.sin(angle) * distance),
          size: 0.4 + Math.random() * 1.5,
          opacity: 0.5 + Math.random() * 0.4,
          speed: Math.random() * 0.008 + 0.003,
          parallax: 0.3 + Math.random() * 0.4,
          twinkle: Math.random() * 100,
          color: ["#ffd700", "#ffeb3b", "#fff8e1", "#fffde7"][
            Math.floor(Math.random() * 4)
          ],
          type: "normal",
          drift: {
            x: (Math.random() - 0.5) * 0.0003,
            y: (Math.random() - 0.5) * 0.0003,
          },
          pulse: Math.random() * 100,
          sparkle: Math.random() * 100,
          constellation: `Globular-${i + 1}`,
        };

        stars.push(star);
      }
    }

    // Generate halo stars (sparse, old, distant)
    for (let i = 0; i < 2000; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = WORLD_SIZE * 0.2 + Math.random() * WORLD_SIZE * 0.4;

      const star: Star = {
        x: normalizeCoord(galacticCenter.x + Math.cos(angle) * distance),
        y: normalizeCoord(galacticCenter.y + Math.sin(angle) * distance),
        size: 0.2 + Math.random() * 0.8,
        opacity: 0.2 + Math.random() * 0.3,
        speed: Math.random() * 0.005 + 0.001,
        parallax: 0.05 + Math.random() * 0.15,
        twinkle: Math.random() * 100,
        color: haloColors[Math.floor(Math.random() * haloColors.length)],
        type: "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0015,
          y: (Math.random() - 0.5) * 0.0015,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
        constellation: "Halo",
      };

      stars.push(star);
    }

    // Generate foreground bright stars for depth
    for (let i = 0; i < 300; i++) {
      const star: Star = {
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: 1.5 + Math.random() * 3.5,
        opacity: 0.3 + Math.random() * 0.4,
        speed: Math.random() * 0.025 + 0.015,
        parallax: 1.2 + Math.random() * 0.6,
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.6
            ? "#ffffff"
            : ["#ff69b4", "#87ceeb", "#98fb98", "#dda0dd"][
                Math.floor(Math.random() * 4)
              ],
        type:
          Math.random() < 0.3
            ? "bright"
            : Math.random() < 0.05
              ? "binary"
              : "normal",
        drift: {
          x: (Math.random() - 0.5) * 0.0002,
          y: (Math.random() - 0.5) * 0.0002,
        },
        pulse: Math.random() * 100,
        sparkle: Math.random() * 100,
        constellation: "Foreground",
      };

      stars.push(star);
    }

    starsRef.current = stars;
    nebulaeRef.current = nebulae;
  }, [normalizeCoord]);

  // Initialize game objects once
  useEffect(() => {
    generateGalacticField();

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
  }, [generateGalacticField]);

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
      const deltaTime = Math.min(currentTime - lastTime, 16.67);
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

      // Update stars and nebulae
      starsRef.current.forEach((star) => {
        star.x = normalizeCoord(star.x + star.drift.x);
        star.y = normalizeCoord(star.y + star.drift.y);
        star.twinkle += star.speed;
        star.pulse += star.speed * 0.8;
        star.sparkle += star.speed * 1.2;
      });

      nebulaeRef.current.forEach((nebula) => {
        nebula.rotation += 0.001;
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

      // Clear canvas with deep space background
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(canvas.width, canvas.height),
      );
      gradient.addColorStop(0, "#0a0a2e");
      gradient.addColorStop(0.5, "#16213e");
      gradient.addColorStop(1, "#0e1b2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render nebulae
      nebulaeRef.current.forEach((nebula) => {
        const wrappedDeltaX = getWrappedDistance(nebula.x, gameState.camera.x);
        const wrappedDeltaY = getWrappedDistance(nebula.y, gameState.camera.y);
        const screenX = centerX + wrappedDeltaX * 0.1;
        const screenY = centerY + wrappedDeltaY * 0.1;

        if (
          screenX > -nebula.size &&
          screenX < canvas.width + nebula.size &&
          screenY > -nebula.size &&
          screenY < canvas.height + nebula.size
        ) {
          ctx.save();
          ctx.globalAlpha = nebula.opacity;
          ctx.translate(screenX, screenY);
          ctx.rotate(nebula.rotation);

          const nebulaGradient = ctx.createRadialGradient(
            0,
            0,
            0,
            0,
            0,
            nebula.size,
          );
          nebulaGradient.addColorStop(0, nebula.color);
          nebulaGradient.addColorStop(0.5, nebula.color + "40");
          nebulaGradient.addColorStop(1, "transparent");

          ctx.fillStyle = nebulaGradient;
          ctx.fillRect(
            -nebula.size,
            -nebula.size,
            nebula.size * 2,
            nebula.size * 2,
          );
          ctx.restore();
        }
      });

      // Render stars by parallax layers
      const parallaxLayers = [
        0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4,
        1.6, 1.8,
      ];

      parallaxLayers.forEach((targetParallax) => {
        starsRef.current.forEach((star) => {
          if (Math.abs(star.parallax - targetParallax) < 0.05) {
            const wrappedDeltaX = getWrappedDistance(
              star.x,
              gameState.camera.x,
            );
            const wrappedDeltaY = getWrappedDistance(
              star.y,
              gameState.camera.y,
            );

            const parallaxX = wrappedDeltaX * star.parallax;
            const parallaxY = wrappedDeltaY * star.parallax;
            const screenX = centerX + parallaxX;
            const screenY = centerY + parallaxY;

            const margin = star.parallax > 1 ? 100 : 50;
            if (
              screenX > -margin &&
              screenX < canvas.width + margin &&
              screenY > -margin &&
              screenY < canvas.height + margin
            ) {
              // Enhanced effects based on star type
              let twinkleAlpha = Math.sin(star.twinkle) * 0.3 + 0.7;
              let pulseSize = 1;
              let finalAlpha = star.opacity * twinkleAlpha;
              let finalSize = star.size;

              switch (star.type) {
                case "giant":
                  pulseSize = Math.sin(star.pulse * 0.5) * 0.4 + 1.2;
                  finalAlpha *= 1.5;
                  finalSize *= 1.8;
                  break;
                case "binary":
                  twinkleAlpha = Math.sin(star.twinkle * 2) * 0.4 + 0.6;
                  finalAlpha *= 1.2;
                  break;
                case "pulsar":
                  twinkleAlpha = Math.sin(star.twinkle * 4) * 0.8 + 0.2;
                  finalAlpha *= 2;
                  break;
                case "bright":
                  finalAlpha *= 1.3;
                  finalSize *= 1.3;
                  break;
              }

              finalSize *= pulseSize;

              ctx.save();
              ctx.fillStyle = star.color;
              ctx.globalAlpha = finalAlpha;

              if (finalSize < 1) {
                // Small distant stars as points
                ctx.beginPath();
                ctx.arc(
                  Math.round(screenX),
                  Math.round(screenY),
                  finalSize,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              } else {
                // Larger stars as star shapes
                drawStar(
                  ctx,
                  Math.round(screenX),
                  Math.round(screenY),
                  finalSize,
                  4,
                );
                ctx.fill();

                // Enhanced glow for special stars
                if (star.type !== "normal") {
                  ctx.shadowColor = star.color;
                  ctx.shadowBlur = finalSize * (star.type === "giant" ? 4 : 2);
                  ctx.globalAlpha = finalAlpha * 0.3;
                  drawStar(
                    ctx,
                    Math.round(screenX),
                    Math.round(screenY),
                    finalSize * 1.2,
                    4,
                  );
                  ctx.fill();
                  ctx.shadowBlur = 0;

                  // Special effects for different star types
                  if (star.type === "binary") {
                    // Secondary companion star
                    ctx.globalAlpha = finalAlpha * 0.6;
                    drawStar(
                      ctx,
                      Math.round(screenX + finalSize),
                      Math.round(screenY),
                      finalSize * 0.7,
                      4,
                    );
                    ctx.fill();
                  }

                  if (star.type === "pulsar" && finalSize > 2) {
                    // Pulsar beams
                    ctx.globalAlpha = finalAlpha * 0.5;
                    ctx.strokeStyle = star.color;
                    ctx.lineWidth = 1;
                    const beamLength = finalSize * 6;
                    ctx.beginPath();
                    ctx.moveTo(screenX - beamLength, screenY);
                    ctx.lineTo(screenX + beamLength, screenY);
                    ctx.moveTo(screenX, screenY - beamLength);
                    ctx.lineTo(screenX, screenY + beamLength);
                    ctx.stroke();
                  }
                }
              }

              ctx.restore();
            }
          }
        });
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
  }, [gameState, getWrappedDistance, normalizeCoord, drawStar]);

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
