import React, { useRef, useEffect, useState, useCallback } from "react";
import { useGameStore } from "../../store/gameStore";
import { useShipStatePersistence } from "../../hooks/useShipStatePersistence";
import { PlanetLandingModal } from "./PlanetLandingModal";
import { WorldEditor } from "../Admin/WorldEditor";
import { gameService } from "../../services/gameService";
import { WorldPosition } from "../../types/game";

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
  baseX: number; // Posição base para movimento oscilatório
  baseY: number; // Posição base para movimento oscilatório
  floatAmplitude: { x: number; y: number }; // Amplitude do movimento de flutuação
  floatPhase: { x: number; y: number }; // Fase do movimento senoidal
}

interface Planet {
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  name: string;
  interactionRadius: number;
  imageUrl: string;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
  color: string;
  tailLength: number;
}

interface RadarPulse {
  planetId: string;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  opacity: number;
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

const WORLD_SIZE = 15000;
const SHIP_MAX_SPEED = 2;
const FRICTION = 0.88;
const CENTER_X = WORLD_SIZE / 2;
const CENTER_Y = WORLD_SIZE / 2;
const BARRIER_RADIUS = 600;

// Pre-render buffer size
const RENDER_BUFFER = 200;

export const SpaceMap: React.FC = () => {
  const { getShipState, setCurrentScreen, setCurrentPlanet, isWorldEditMode } =
    useGameStore();
  const { saveShipState, forceSaveShipState } = useShipStatePersistence();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0 });
  const hasMouseMoved = useRef(false);
  const starsRef = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const radarPulsesRef = useRef<RadarPulse[]>([]);
  const lastShootingStarTime = useRef(0);
  const lastRadarCheckRef = useRef<Set<string>>(new Set());
  const lastRadarPulseTime = useRef<Map<string, number>>(new Map());
  const planetImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Initialize state from store or use defaults
  const getInitialGameState = useCallback((): GameState => {
    const savedState = getShipState();
    if (savedState) {
      return {
        ship: {
          x: savedState.x,
          y: savedState.y,
          angle: 0, // Reset angle to neutral position
          vx: 0, // Reset velocity to stop movement
          vy: 0, // Reset velocity to stop movement
        },
        camera: {
          x: savedState.cameraX,
          y: savedState.cameraY,
        },
      };
    }
    return {
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
    };
  }, [getShipState]);

  const [gameState, setGameState] = useState<GameState>(getInitialGameState);

  // Reset velocities on component mount to ensure ship starts stationary
  useEffect(() => {
    setGameState((prevState) => ({
      ...prevState,
      ship: {
        ...prevState.ship,
        vx: 0,
        vy: 0,
        angle: 0,
      },
    }));
  }, []); // Empty dependency array ensures this runs only on mount

  // FPS tracking
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({
    frameCount: 0,
    lastTime: 0,
    frameTimes: [] as number[],
  });

  // Mouse state tracking
  const [mouseInWindow, setMouseInWindow] = useState(true);

  // Modal state
  const [showLandingModal, setShowLandingModal] = useState(false);
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);

  // World editing state
  const [worldPositions, setWorldPositions] = useState<WorldPosition[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  // Function to check if click is on visible pixel of planet image
  const isClickOnPlanetPixel = useCallback(
    (
      planet: Planet,
      clickWorldX: number,
      clickWorldY: number,
      canvas: HTMLCanvasElement,
    ): boolean => {
      const img = planetImagesRef.current.get(planet.id);
      if (!img || !img.complete) {
        // Fallback to circle detection if image not loaded
        const dx = getWrappedDistance(planet.x, clickWorldX);
        const dy = getWrappedDistance(planet.y, clickWorldY);
        return Math.sqrt(dx * dx + dy * dy) <= planet.size;
      }

      // Create temporary canvas to check pixel data
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return false;

      const imageSize = planet.size * 2; // Diameter
      tempCanvas.width = imageSize;
      tempCanvas.height = imageSize;

      // Draw the image on temp canvas
      tempCtx.drawImage(img, 0, 0, imageSize, imageSize);

      // Calculate relative position within the image
      const dx = getWrappedDistance(planet.x, clickWorldX);
      const dy = getWrappedDistance(planet.y, clickWorldY);

      // Convert to image coordinates (center the image)
      const imgX = dx + imageSize / 2;
      const imgY = dy + imageSize / 2;

      // Check if within image bounds
      if (imgX < 0 || imgX >= imageSize || imgY < 0 || imgY >= imageSize) {
        return false;
      }

      // Get pixel data at the click position
      try {
        const pixelData = tempCtx.getImageData(imgX, imgY, 1, 1).data;
        const alpha = pixelData[3]; // Alpha channel
        return alpha > 50; // Consider pixel visible if alpha > 50
      } catch (e) {
        // Fallback to circle detection if there's an error
        return Math.sqrt(dx * dx + dy * dy) <= planet.size;
      }
    },
    [getWrappedDistance],
  );

  // Create shooting star
  const createShootingStar = useCallback((canvas: HTMLCanvasElement) => {
    const colors = ["#ffffff", "#ffe4b5", "#ffd700", "#87ceeb", "#ff69b4"];
    const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    const speed = 3 + Math.random() * 4;
    const angle = Math.random() * Math.PI * 0.4 + Math.PI * 0.3; // Diagonal direction

    let startX, startY, vx, vy;

    // Start from edges and move diagonally across screen
    switch (side) {
      case 0: // from top
        startX = Math.random() * canvas.width;
        startY = -50;
        vx = (Math.random() - 0.5) * speed;
        vy = speed;
        break;
      case 1: // from right
        startX = canvas.width + 50;
        startY = Math.random() * canvas.height;
        vx = -speed;
        vy = (Math.random() - 0.5) * speed;
        break;
      case 2: // from bottom
        startX = Math.random() * canvas.width;
        startY = canvas.height + 50;
        vx = (Math.random() - 0.5) * speed;
        vy = -speed;
        break;
      default: // from left
        startX = -50;
        startY = Math.random() * canvas.height;
        vx = speed;
        vy = (Math.random() - 0.5) * speed;
        break;
    }

    const newShootingStar: ShootingStar = {
      x: startX,
      y: startY,
      vx,
      vy,
      life: 120 + Math.random() * 60, // 2-3 seconds at 60fps
      maxLife: 120 + Math.random() * 60,
      size: 0.8 + Math.random() * 1.2,
      opacity: 0.6 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      tailLength: 15 + Math.random() * 20,
    };

    shootingStarsRef.current.push(newShootingStar);
  }, []);

  // Helper function to draw shooting star with tail
  const drawShootingStar = useCallback(
    (ctx: CanvasRenderingContext2D, shootingStar: ShootingStar) => {
      const fadeRatio = shootingStar.life / shootingStar.maxLife;
      const currentOpacity = shootingStar.opacity * fadeRatio;

      // Draw tail
      const tailPoints = 8;
      ctx.save();
      ctx.globalAlpha = currentOpacity * 0.6;

      for (let i = 0; i < tailPoints; i++) {
        const ratio = i / tailPoints;
        const tailX =
          shootingStar.x - shootingStar.vx * ratio * shootingStar.tailLength;
        const tailY =
          shootingStar.y - shootingStar.vy * ratio * shootingStar.tailLength;
        const tailSize = shootingStar.size * (1 - ratio) * 0.8;
        const tailAlpha = currentOpacity * (1 - ratio) * 0.5;

        ctx.globalAlpha = tailAlpha;
        ctx.fillStyle = shootingStar.color;
        ctx.beginPath();
        ctx.arc(tailX, tailY, tailSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw main star
      ctx.globalAlpha = currentOpacity;
      ctx.fillStyle = shootingStar.color;
      ctx.beginPath();
      ctx.arc(
        shootingStar.x,
        shootingStar.y,
        shootingStar.size,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Add bright core
      ctx.globalAlpha = currentOpacity * 1.2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(
        shootingStar.x,
        shootingStar.y,
        shootingStar.size * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.restore();
    },
    [],
  );

  // Create radar pulse towards planet
  const createRadarPulse = useCallback((planet: Planet) => {
    const newPulse: RadarPulse = {
      planetId: planet.id,
      radius: 8, // Raio inicial original
      maxRadius: 40, // Expansão menor
      life: 160, // Vida mais longa para compensar expansão lenta
      maxLife: 160,
      opacity: 1.2, // Opacidade muito alta para verde ser mais visível
    };

    radarPulsesRef.current.push(newPulse);
  }, []);

  // Helper function to draw directional radar pulse
  const drawRadarPulse = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      pulse: RadarPulse,
      shipScreenX: number,
      shipScreenY: number,
      currentShipX: number,
      currentShipY: number,
    ) => {
      // Buscar o planeta correspondente a este pulse
      const planet = planetsRef.current.find((p) => p.id === pulse.planetId);
      if (!planet) return;

      // Calcular ângulo dinamicamente baseado na posição atual da nave
      const dx = getWrappedDistance(planet.x, currentShipX);
      const dy = getWrappedDistance(planet.y, currentShipY);
      const dynamicAngle = Math.atan2(dy, dx);

      const fadeRatio = pulse.life / pulse.maxLife;
      const expandRatio = (pulse.maxRadius - pulse.radius) / pulse.maxRadius;

      // Better fade out for improved visibility
      const currentOpacity =
        pulse.opacity * fadeRatio * (0.5 + expandRatio * 0.5);

      ctx.save();

      // Gradiente verde 3D mais vibrante
      const gradient = ctx.createRadialGradient(
        shipScreenX,
        shipScreenY,
        0,
        shipScreenX,
        shipScreenY,
        pulse.radius,
      );
      gradient.addColorStop(0, `rgba(150, 255, 150, ${currentOpacity})`); // Verde muito claro centro
      gradient.addColorStop(0.4, `rgba(50, 255, 50, ${currentOpacity})`); // Verde claro
      gradient.addColorStop(0.7, `rgba(0, 255, 0, ${currentOpacity * 0.9})`); // Verde puro vibrante
      gradient.addColorStop(1, `rgba(0, 200, 0, ${currentOpacity * 0.6})`); // Verde médio

      // Arco original
      const arcWidth = Math.PI / 3; // 60 graus original
      const startAngle = dynamicAngle - arcWidth / 2;
      const endAngle = dynamicAngle + arcWidth / 2;

      // Linha principal mais fina
      ctx.globalAlpha = currentOpacity;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3; // Linha mais fina
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.arc(shipScreenX, shipScreenY, pulse.radius, startAngle, endAngle);
      ctx.stroke();

      // Brilho interno verde mais forte para efeito 3D
      ctx.globalAlpha = currentOpacity;
      ctx.strokeStyle = `rgba(200, 255, 200, ${currentOpacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(shipScreenX, shipScreenY, pulse.radius, startAngle, endAngle);
      ctx.stroke();

      ctx.restore();
    },
    [getWrappedDistance],
  );

  // Helper function to draw pure light points
  const drawPureLightStar = useCallback(
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

      // Main star core - pure light point
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Subtle glow effect only for larger stars
      if (size > 1.0) {
        const glowRadius = size * 2;
        const glowIntensity =
          type === "giant" ? 0.6 : type === "bright" ? 0.4 : 0.3;

        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, hexToRgba(color, intensity * glowIntensity));
        gradient.addColorStop(0.8, hexToRgba(color, intensity * 0.1));
        gradient.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.fill();
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

    // Layer 1: Deep background (parallax 0.1) - ABAIXO do jogador
    for (let i = 0; i < 800; i++) {
      const baseX = Math.random() * WORLD_SIZE;
      const baseY = Math.random() * WORLD_SIZE;
      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: 0.4 + Math.random() * 0.6,
        opacity: 0.2 + Math.random() * 0.3,
        speed: Math.random() * 0.015 + 0.005,
        parallax: 0.1, // Camada mais distante
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.85
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: "normal",
        drift: {
          x: 0, // Movimento será calculado via seno/cosseno
          y: 0,
        },
        pulse: Math.random() * 100,
        floatAmplitude: {
          x: Math.random() * 12 + 4, // Movimento visível para camada distante
          y: Math.random() * 12 + 4,
        },
        floatPhase: {
          x: Math.random() * Math.PI * 2, // Fase inicial aleatória
          y: Math.random() * Math.PI * 2,
        },
      });
    }

    // Layer 2: Mid background (parallax 0.3) - ABAIXO do jogador
    for (let i = 0; i < 700; i++) {
      const baseX = Math.random() * WORLD_SIZE;
      const baseY = Math.random() * WORLD_SIZE;
      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: 0.6 + Math.random() * 0.8,
        opacity: 0.3 + Math.random() * 0.35,
        speed: Math.random() * 0.018 + 0.007,
        parallax: 0.3, // Paralaxe distinta
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.8
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.1 ? "bright" : "normal",
        drift: {
          x: 0,
          y: 0,
        },
        pulse: Math.random() * 100,
        floatAmplitude: {
          x: Math.random() * 10 + 3,
          y: Math.random() * 10 + 3,
        },
        floatPhase: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
        },
      });
    }

    // Layer 3: Near background (parallax 0.6) - ABAIXO do jogador
    for (let i = 0; i < 600; i++) {
      const baseX = Math.random() * WORLD_SIZE;
      const baseY = Math.random() * WORLD_SIZE;
      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: 0.8 + Math.random() * 1.2,
        opacity: 0.4 + Math.random() * 0.4,
        speed: Math.random() * 0.022 + 0.009,
        parallax: 0.6, // Paralaxe distinta
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.75
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.15 ? "bright" : "normal",
        drift: {
          x: 0,
          y: 0,
        },
        pulse: Math.random() * 100,
        floatAmplitude: {
          x: Math.random() * 8 + 2.5,
          y: Math.random() * 8 + 2.5,
        },
        floatPhase: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
        },
      });
    }

    // Layer 4: Close background (parallax 0.9) - ABAIXO do jogador
    for (let i = 0; i < 500; i++) {
      const baseX = Math.random() * WORLD_SIZE;
      const baseY = Math.random() * WORLD_SIZE;
      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: 1.0 + Math.random() * 1.5,
        opacity: 0.45 + Math.random() * 0.4,
        speed: Math.random() * 0.025 + 0.012,
        parallax: 0.9, // Paralaxe distinta
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.7
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.2 ? "bright" : "normal",
        drift: {
          x: 0,
          y: 0,
        },
        pulse: Math.random() * 100,
        floatAmplitude: {
          x: Math.random() * 6 + 2,
          y: Math.random() * 6 + 2,
        },
        floatPhase: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
        },
      });
    }

    // Layer 5: Cosmic dust foreground (parallax 1.2) - ACIMA do jogador
    for (let i = 0; i < 400; i++) {
      const baseX = Math.random() * WORLD_SIZE;
      const baseY = Math.random() * WORLD_SIZE;
      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: 0.3 + Math.random() * 0.7, // Tamanhos menores para poeira cósmica
        opacity: 0.2 + Math.random() * 0.25,
        speed: Math.random() * 0.01 + 0.005, // Velocidade reduzida
        parallax: 1.2, // Paralaxe de primeiro plano
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.7
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.15 ? "bright" : "normal", // Menos estrelas giant
        drift: {
          x: 0,
          y: 0,
        },
        pulse: Math.random() * 100,
        floatAmplitude: {
          x: Math.random() * 5 + 1.5, // Movimento visível para poeira cósmica
          y: Math.random() * 5 + 1.5,
        },
        floatPhase: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
        },
      });
    }

    // Layer 6: Close cosmic dust (parallax 1.6) - ACIMA do jogador
    for (let i = 0; i < 300; i++) {
      const baseX = Math.random() * WORLD_SIZE;
      const baseY = Math.random() * WORLD_SIZE;
      stars.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        size: 0.2 + Math.random() * 0.5, // Ainda menores para camada mais próxima
        opacity: 0.1 + Math.random() * 0.15, // Mais transparentes
        speed: Math.random() * 0.008 + 0.003, // Muito lento
        parallax: 1.6, // Máximo paralaxe
        twinkle: Math.random() * 100,
        color:
          Math.random() < 0.8
            ? "#ffffff"
            : starColors[Math.floor(Math.random() * starColors.length)],
        type: Math.random() < 0.1 ? "bright" : "normal", // Principalmente normais
        drift: {
          x: 0,
          y: 0,
        },
        pulse: Math.random() * 100,
        floatAmplitude: {
          x: Math.random() * 4 + 1, // Movimento sutil mas visível
          y: Math.random() * 4 + 1,
        },
        floatPhase: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
        },
      });
    }

    starsRef.current = stars;
  }, []);

  // Load world positions from database
  const loadWorldPositions = useCallback(async () => {
    try {
      const positions = await gameService.getWorldPositions();
      setWorldPositions(positions);

      // Convert to planets format for rendering
      const planets: Planet[] = positions.map((position) => ({
        id: position.id,
        x: position.x,
        y: position.y,
        size: position.size,
        rotation: position.rotation,
        color: position.color,
        name: position.name,
        interactionRadius: Math.max(90, position.size + 30),
        imageUrl: position.imageUrl || "",
      }));

      // Preload planet images
      positions.forEach((position) => {
        if (position.imageUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = position.imageUrl;
          img.onload = () => {
            planetImagesRef.current.set(position.id, img);
          };
        }
      });

      planetsRef.current = planets;
    } catch (error) {
      console.error("Failed to load world positions:", error);
    }
  }, []);

  // Initialize game objects once
  useEffect(() => {
    generateRichStarField();
    loadWorldPositions();
  }, [generateRichStarField, loadWorldPositions]);

  // Handle world updates in edit mode
  const handleWorldUpdate = useCallback(
    (worldId: string, updates: Partial<WorldPosition>) => {
      setWorldPositions((prev) =>
        prev.map((world) =>
          world.id === worldId ? { ...world, ...updates } : world,
        ),
      );

      // Update planets ref for rendering
      planetsRef.current = planetsRef.current.map((planet) =>
        planet.id === worldId
          ? {
              ...planet,
              size: updates.size ?? planet.size,
              rotation: updates.rotation ?? planet.rotation,
              interactionRadius: updates.size
                ? Math.max(90, updates.size + 30)
                : planet.interactionRadius,
            }
          : planet,
      );
    },
    [],
  );

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const newMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Handle world dragging in edit mode
      if (isWorldEditMode && isDragging && selectedWorldId) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const worldX =
          newMousePos.x - centerX + gameState.camera.x - dragOffset.x;
        const worldY =
          newMousePos.y - centerY + gameState.camera.y - dragOffset.y;

        // Update world position immediately for responsive feedback
        handleWorldUpdate(selectedWorldId, { x: worldX, y: worldY });

        // Save to database with throttling
        clearTimeout((window as any).worldDragTimeout);
        (window as any).worldDragTimeout = setTimeout(async () => {
          await gameService.updateWorldPosition(selectedWorldId, {
            x: worldX,
            y: worldY,
          });
        }, 100);
      }

      mouseRef.current = newMousePos;
      hasMouseMoved.current = true;
    },
    [
      isWorldEditMode,
      isDragging,
      selectedWorldId,
      gameState.camera,
      dragOffset,
      handleWorldUpdate,
    ],
  );

  // Handle mouse leaving canvas
  const handleMouseLeave = useCallback(() => {
    setMouseInWindow(false);
    hasMouseMoved.current = false; // Reset mouse movement flag
  }, []);

  // Handle mouse entering canvas
  const handleMouseEnter = useCallback(() => {
    setMouseInWindow(true);
  }, []);

  // Handle clicking (shooting or world editing)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Convert click position to world coordinates
      const worldClickX = clickX - centerX + gameState.camera.x;
      const worldClickY = clickY - centerY + gameState.camera.y;

      // World editing mode handling
      if (isWorldEditMode) {
        let worldClicked = false;

        planetsRef.current.forEach((planet) => {
          const dx = getWrappedDistance(planet.x, worldClickX);
          const dy = getWrappedDistance(planet.y, worldClickY);
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= planet.size) {
            setSelectedWorldId(planet.id);
            setIsDragging(true);
            setDragOffset({ x: dx, y: dy });
            worldClicked = true;
          }
        });

        if (!worldClicked) {
          setSelectedWorldId(null);
        }
        return;
      }

      // Normal game mode handling
      let clickedOnPlanet = false;

      planetsRef.current.forEach((planet) => {
        const shipToPlanetX = getWrappedDistance(planet.x, gameState.ship.x);
        const shipToPlanetY = getWrappedDistance(planet.y, gameState.ship.y);
        const shipToPlanetDistance = Math.sqrt(
          shipToPlanetX * shipToPlanetX + shipToPlanetY * shipToPlanetY,
        );

        // Only check for planet click if ship is within interaction radius
        if (shipToPlanetDistance <= planet.interactionRadius) {
          // Check if the click was specifically on a visible pixel of the planet image
          if (isClickOnPlanetPixel(planet, worldClickX, worldClickY, canvas)) {
            setSelectedPlanet(planet);
            setShowLandingModal(true);
            clickedOnPlanet = true;
          }
        }
      });

      // Only shoot if we didn't click on a planet
      if (!clickedOnPlanet) {
        const newProjectile: Projectile = {
          x: gameState.ship.x,
          y: gameState.ship.y,
          vx: Math.cos(gameState.ship.angle) * 10,
          vy: Math.sin(gameState.ship.angle) * 10,
          life: 80,
        };
        projectilesRef.current.push(newProjectile);
      }
    },
    [gameState, getWrappedDistance, isWorldEditMode],
  );

  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    if (isWorldEditMode && isDragging) {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [isWorldEditMode, isDragging]);

  // Modal handlers
  const handleLandingConfirm = useCallback(() => {
    if (selectedPlanet) {
      setCurrentPlanet(selectedPlanet);
      setCurrentScreen("planet");
    }
    setShowLandingModal(false);
    setSelectedPlanet(null);
  }, [selectedPlanet, setCurrentPlanet, setCurrentScreen]);

  const handleLandingCancel = useCallback(() => {
    setShowLandingModal(false);
    setSelectedPlanet(null);
    // Force reset mouse state to ensure ship responds immediately
    hasMouseMoved.current = true;
    setMouseInWindow(true);
  }, []);

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

        // Only respond to mouse if it has actually moved and modal is not open
        if (hasMouseMoved.current && !showLandingModal) {
          const worldMouseX = mouseRef.current.x - centerX + newState.camera.x;
          const worldMouseY = mouseRef.current.y - centerY + newState.camera.y;

          const dx = getWrappedDistance(worldMouseX, newState.ship.x);
          const dy = getWrappedDistance(worldMouseY, newState.ship.y);
          const distance = Math.sqrt(dx * dx + dy * dy);

          newState.ship.angle = Math.atan2(dy, dx);

          if (mouseInWindow && distance > 10) {
            const speedMultiplier = Math.min(distance / 300, 1);
            const targetSpeed = SHIP_MAX_SPEED * speedMultiplier;
            newState.ship.vx += (dx / distance) * targetSpeed * 0.04;
            newState.ship.vy += (dy / distance) * targetSpeed * 0.04;
          }
        }

        // Apply less friction when mouse is outside window to maintain momentum
        const currentFriction = mouseInWindow ? FRICTION : 0.995;
        newState.ship.vx *= currentFriction;
        newState.ship.vy *= currentFriction;
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

      // Save to store for persistence (throttled) - moved outside setState
      saveShipState({
        x: gameState.ship.x,
        y: gameState.ship.y,
        angle: gameState.ship.angle,
        vx: gameState.ship.vx,
        vy: gameState.ship.vy,
        cameraX: gameState.camera.x,
        cameraY: gameState.camera.y,
      });

      // Check for planets in range and create radar pulses
      const currentShipState = gameState;
      const currentPlanetsInRange = new Set<string>();

      planetsRef.current.forEach((planet) => {
        const shipToPlanetX = getWrappedDistance(
          planet.x,
          currentShipState.ship.x,
        );
        const shipToPlanetY = getWrappedDistance(
          planet.y,
          currentShipState.ship.y,
        );
        const shipToPlanetDistance = Math.sqrt(
          shipToPlanetX * shipToPlanetX + shipToPlanetY * shipToPlanetY,
        );

        if (shipToPlanetDistance <= planet.interactionRadius) {
          currentPlanetsInRange.add(planet.id);

          // Create radar pulse every 1200ms for much slower waves
          const lastPulseTime = lastRadarPulseTime.current.get(planet.id) || 0;
          if (currentTime - lastPulseTime >= 1200) {
            // 1.2 seconds = 1200ms for slower spacing
            createRadarPulse(planet);
            lastRadarPulseTime.current.set(planet.id, currentTime);
          }
        } else {
          // Remove pulse timing when out of range
          lastRadarPulseTime.current.delete(planet.id);
        }
      });

      // Update the tracking set
      lastRadarCheckRef.current = currentPlanetsInRange;

      // Update radar pulses
      radarPulsesRef.current = radarPulsesRef.current
        .map((pulse) => ({
          ...pulse,
          radius: pulse.radius + 0.4, // Expansão muito mais lenta
          life: pulse.life - 1,
        }))
        .filter((pulse) => pulse.life > 0 && pulse.radius <= pulse.maxRadius);

      // Update stars with floating motion
      const stars = starsRef.current;
      const time = currentTime * 0.002; // Increased time for visible movement
      for (let i = 0, len = stars.length; i < len; i++) {
        const star = stars[i];

        // Floating motion using sine/cosine waves for cosmic dust effect
        const floatTime = time * (0.5 + star.speed * 5); // More visible speed variation
        const floatX =
          Math.sin(floatTime + star.floatPhase.x) * star.floatAmplitude.x;
        const floatY =
          Math.cos(floatTime * 0.7 + star.floatPhase.y) * star.floatAmplitude.y;

        star.x = normalizeCoord(star.baseX + floatX);
        star.y = normalizeCoord(star.baseY + floatY);

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

      // Create shooting stars periodically
      if (
        currentTime - lastShootingStarTime.current >
        8000 + Math.random() * 12000
      ) {
        // Every 8-20 seconds
        createShootingStar(canvas);
        lastShootingStarTime.current = currentTime;
      }

      // Update shooting stars
      shootingStarsRef.current = shootingStarsRef.current
        .map((star) => ({
          ...star,
          x: star.x + star.vx,
          y: star.y + star.vy,
          life: star.life - 1,
        }))
        .filter(
          (star) =>
            star.life > 0 &&
            star.x > -100 &&
            star.x < canvas.width + 100 &&
            star.y > -100 &&
            star.y < canvas.height + 100,
        );

      // Clear canvas with solid black background
      ctx.fillStyle = "#000000";
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
          drawPureLightStar(
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
          // Check if ship is within interaction radius for visual feedback
          const shipToPlanetX = getWrappedDistance(planet.x, gameState.ship.x);
          const shipToPlanetY = getWrappedDistance(planet.y, gameState.ship.y);
          const shipToPlanetDistance = Math.sqrt(
            shipToPlanetX * shipToPlanetX + shipToPlanetY * shipToPlanetY,
          );
          const isInRange = shipToPlanetDistance <= planet.interactionRadius;

          // Render interaction circle
          ctx.save();
          ctx.globalAlpha = isInRange ? 0.4 : 0.15;
          ctx.strokeStyle = isInRange ? "#00ff00" : "#ffffff";
          ctx.lineWidth = isInRange ? 3 : 1;
          ctx.setLineDash(isInRange ? [] : [5, 5]);
          ctx.beginPath();
          ctx.arc(screenX, screenY, planet.interactionRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Render planet image
          const img = planetImagesRef.current.get(planet.id);
          if (img && img.complete) {
            ctx.save();
            ctx.globalAlpha = 1;

            const imageSize = planet.size * 2; // Use diameter as image size
            const drawX = screenX - imageSize / 2;
            const drawY = screenY - imageSize / 2;

            // Draw the planet image
            ctx.drawImage(img, drawX, drawY, imageSize, imageSize);
            ctx.restore();
          } else {
            // Fallback to colored circle if image not loaded
            ctx.globalAlpha = 1;
            ctx.fillStyle = planet.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, planet.size, 0, Math.PI * 2);
            ctx.fill();

            // Planet highlight
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

      // Render shooting stars
      shootingStarsRef.current.forEach((shootingStar) => {
        drawShootingStar(ctx, shootingStar);
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

      // Render radar pulses
      radarPulsesRef.current.forEach((pulse) => {
        drawRadarPulse(
          ctx,
          pulse,
          shipScreenX,
          shipScreenY,
          gameState.ship.x,
          gameState.ship.y,
        );
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      // Force save final state when component unmounts
      forceSaveShipState({
        x: gameState.ship.x,
        y: gameState.ship.y,
        angle: gameState.ship.angle,
        vx: gameState.ship.vx,
        vy: gameState.ship.vy,
        cameraX: gameState.camera.x,
        cameraY: gameState.camera.y,
      });
    };
  }, [
    gameState,
    getWrappedDistance,
    normalizeCoord,
    drawPureLightStar,
    saveShipState,
    forceSaveShipState,
    createRadarPulse,
    drawRadarPulse,
    showLandingModal,
    mouseInWindow,
    createShootingStar,
    drawShootingStar,
    isClickOnPlanetPixel,
  ]);

  return (
    <div className="w-full h-full relative bg-gray-900 rounded-lg overflow-hidden">
      <PlanetLandingModal
        isOpen={showLandingModal}
        planet={selectedPlanet}
        onConfirm={handleLandingConfirm}
        onCancel={handleLandingCancel}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='3' fill='%230080ff' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E") 8 8, auto`,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
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
