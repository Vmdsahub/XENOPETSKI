import React, { useRef, useEffect, useState, useCallback } from "react";
import { useGameStore } from "../../store/gameStore";
import { useShipStatePersistence } from "../../hooks/useShipStatePersistence";
import { PlanetLandingModal } from "./PlanetLandingModal";
import { gameService } from "../../services/gameService";
import {
  playLaserShootSound,
  playLandingSound,
  startContinuousMovementSound,
  updateContinuousMovementSound,
  stopContinuousMovementSound,
} from "../../utils/soundManager";

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
  floatAmplitude: { x: number; y: number }; // Amplitude do movimento de flutua��ão
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
  maxLife: number;
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

interface TrailPoint {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  intensity: number;
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
const PROJECTILE_SPEED = 600; // pixels per second (consistent across all FPS)
const PROJECTILE_LIFETIME = 4.0; // seconds

// Pre-render buffer size
const RENDER_BUFFER = 200;

// Trail constants
const TRAIL_MAX_POINTS = 25;
const TRAIL_POINT_DISTANCE = 6;
const TRAIL_LIFETIME = 1200; // milliseconds
const TRAIL_WIDTH = 12;

export const SpaceMap: React.FC = () => {
  const {
    getShipState,
    setCurrentScreen,
    setCurrentPlanet,
    isWorldEditMode,
    setWorldEditMode,
    user,
    worldPositions,
    loadWorldPositions,
    updateWorldPosition,
  } = useGameStore();
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
  const trailPointsRef = useRef<TrailPoint[]>([]);
  const lastTrailTime = useRef<number>(0);
  const lastShootingStarTime = useRef(0);
  const lastShootTime = useRef(0);
  const lastRadarCheckRef = useRef<Set<string>>(new Set());
  const shootingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef(performance.now());
  const [isMousePressed, setIsMousePressed] = useState(false);
  const lastRadarPulseTime = useRef<Map<string, number>>(new Map());
  const planetImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const shipImageRef = useRef<HTMLImageElement | null>(null);
  const movementSoundActiveRef = useRef<boolean>(false);

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

  // Landing animation state
  const [isLandingAnimationActive, setIsLandingAnimationActive] =
    useState(false);
  const [landingAnimationData, setLandingAnimationData] = useState<{
    planet: Planet;
    startTime: number;
    duration: number;
    initialShipX: number;
    initialShipY: number;
  } | null>(null);

  // World editing state
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

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

  // Função de tiro que pode ser reutilizada
  const shootProjectile = useCallback(() => {
    const currentTime = Date.now();
    const SHOOT_COOLDOWN = 333; // 333ms entre tiros (3 tiros/segundo)

    // Verificar cooldown
    if (currentTime - lastShootTime.current >= SHOOT_COOLDOWN) {
      const newProjectile: Projectile = {
        x: gameState.ship.x,
        y: gameState.ship.y,
        vx: Math.cos(gameState.ship.angle) * PROJECTILE_SPEED,
        vy: Math.sin(gameState.ship.angle) * PROJECTILE_SPEED,
        life: PROJECTILE_LIFETIME,
        maxLife: PROJECTILE_LIFETIME,
      };
      projectilesRef.current.push(newProjectile);
      lastShootTime.current = currentTime;

      // Tocar som de laser
      playLaserShootSound().catch(() => {
        // Som não é crítico, ignora erro
      });

      return true; // Tiro disparado
    }
    return false; // Cooldown ainda ativo
  }, [gameState.ship.x, gameState.ship.y, gameState.ship.angle]);

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

  // Create trail point function
  const createTrailPoint = useCallback(
    (x: number, y: number, currentTime: number, shipVelocity: number) => {
      const intensity = Math.min(shipVelocity / SHIP_MAX_SPEED, 1);

      trailPointsRef.current.push({
        x,
        y,
        life: TRAIL_LIFETIME,
        maxLife: TRAIL_LIFETIME,
        intensity,
      });

      // Keep only the most recent trail points
      if (trailPointsRef.current.length > TRAIL_MAX_POINTS) {
        trailPointsRef.current.shift();
      }
    },
    [],
  );

  // Update trail points function
  const updateTrailPoints = useCallback((deltaTime: number) => {
    trailPointsRef.current.forEach((point) => {
      point.life -= deltaTime;
    });

    // Remove dead trail points
    trailPointsRef.current = trailPointsRef.current.filter(
      (point) => point.life > 0,
    );
  }, []);

  // Draw trail function
  const drawShipTrail = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      shipScreenX: number,
      shipScreenY: number,
      shipWorldX: number,
      shipWorldY: number,
    ) => {
      if (trailPointsRef.current.length < 2) return;

      ctx.save();

      // Enable global shadow for intense glow effect
      const time = Date.now() * 0.003;
      const pulseIntensity = 0.7 + 0.3 * Math.sin(time); // Pulsing effect

      // Draw each segment of the trail
      for (let i = 0; i < trailPointsRef.current.length - 1; i++) {
        const current = trailPointsRef.current[i];
        const next = trailPointsRef.current[i + 1];

        const currentLifeRatio = current.life / current.maxLife;
        const nextLifeRatio = next.life / next.maxLife;

        // Calculate screen positions using wrapped distance
        const currentDx = getWrappedDistance(current.x, shipWorldX);
        const currentDy = getWrappedDistance(current.y, shipWorldY);
        const currentScreenX = shipScreenX + currentDx;
        const currentScreenY = shipScreenY + currentDy;

        const nextDx = getWrappedDistance(next.x, shipWorldX);
        const nextDy = getWrappedDistance(next.y, shipWorldY);
        const nextScreenX = shipScreenX + nextDx;
        const nextScreenY = shipScreenY + nextDy;

        // Create gradient for the trail segment
        const distance = Math.sqrt(
          Math.pow(nextScreenX - currentScreenX, 2) +
            Math.pow(nextScreenY - currentScreenY, 2),
        );

        if (distance > 0) {
          const gradient = ctx.createLinearGradient(
            currentScreenX,
            currentScreenY,
            nextScreenX,
            nextScreenY,
          );

          // Yellow glow effect with intensity-based strength - ultra bright
          const currentAlpha = Math.min(
            currentLifeRatio * current.intensity * 0.95,
            0.9,
          );
          const nextAlpha = Math.min(
            nextLifeRatio * next.intensity * 0.95,
            0.9,
          );
          const avgAlpha = (currentAlpha + nextAlpha) / 2;
          const avgIntensity = (current.intensity + next.intensity) / 2;

          gradient.addColorStop(0, `rgba(255, 235, 59, ${currentAlpha})`); // Soft yellow
          gradient.addColorStop(1, `rgba(255, 193, 7, ${nextAlpha})`); // Slightly orange yellow

          // Ultra bright outer glow with shadow
          ctx.shadowColor = "#ffeb3b";
          ctx.shadowBlur = 25 * pulseIntensity * avgIntensity;
          ctx.strokeStyle = `rgba(255, 215, 0, ${avgAlpha * 0.8 * pulseIntensity})`;
          ctx.lineWidth =
            TRAIL_WIDTH *
            2.5 *
            ((currentLifeRatio + nextLifeRatio) / 2) *
            avgIntensity;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          ctx.moveTo(currentScreenX, currentScreenY);
          ctx.lineTo(nextScreenX, nextScreenY);
          ctx.stroke();

          // Medium glow layer
          ctx.shadowBlur = 15 * pulseIntensity * avgIntensity;
          ctx.strokeStyle = `rgba(255, 235, 59, ${avgAlpha * 0.9 * pulseIntensity})`;
          ctx.lineWidth =
            TRAIL_WIDTH *
            1.8 *
            ((currentLifeRatio + nextLifeRatio) / 2) *
            avgIntensity;

          ctx.beginPath();
          ctx.moveTo(currentScreenX, currentScreenY);
          ctx.lineTo(nextScreenX, nextScreenY);
          ctx.stroke();

          // Main trail segment with bright glow
          ctx.shadowBlur = 10 * pulseIntensity * avgIntensity;
          ctx.strokeStyle = gradient;
          ctx.lineWidth =
            TRAIL_WIDTH *
            ((currentLifeRatio + nextLifeRatio) / 2) *
            avgIntensity;
          ctx.beginPath();
          ctx.moveTo(currentScreenX, currentScreenY);
          ctx.lineTo(nextScreenX, nextScreenY);
          ctx.stroke();

          // Ultra bright inner core with white hot center
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = 8 * pulseIntensity * avgIntensity;
          ctx.strokeStyle = `rgba(255, 255, 255, ${avgAlpha * 0.9 * pulseIntensity})`;
          ctx.lineWidth =
            TRAIL_WIDTH *
            0.6 *
            ((currentLifeRatio + nextLifeRatio) / 2) *
            avgIntensity;
          ctx.beginPath();
          ctx.moveTo(currentScreenX, currentScreenY);
          ctx.lineTo(nextScreenX, nextScreenY);
          ctx.stroke();

          // Final bright yellow core
          ctx.shadowColor = "#ffff00";
          ctx.shadowBlur = 5 * pulseIntensity * avgIntensity;
          ctx.strokeStyle = `rgba(255, 255, 150, ${avgAlpha * pulseIntensity})`;
          ctx.lineWidth =
            TRAIL_WIDTH *
            0.3 *
            ((currentLifeRatio + nextLifeRatio) / 2) *
            avgIntensity;
          ctx.beginPath();
          ctx.moveTo(currentScreenX, currentScreenY);
          ctx.lineTo(nextScreenX, nextScreenY);
          ctx.stroke();
        }
      }

      // Reset shadow effects to not affect other elements
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

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

  // Update planets when worldPositions change
  const updatePlanetsFromStore = useCallback(() => {
    if (worldPositions.length > 0) {
      // Use store positions
      const planets: Planet[] = worldPositions.map((position) => ({
        id: position.id,
        x: position.x,
        y: position.y,
        size: position.size,
        rotation: position.rotation,
        color: position.color,
        name: position.name,
        interactionRadius: position.interactionRadius,
        imageUrl: position.imageUrl || "",
      }));

      // Preload planet images
      worldPositions.forEach((position) => {
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
    } else {
      // Fallback to default positions if no data in store
      generateDefaultPlanets();
    }
  }, [worldPositions]);

  // Generate default planets (fallback)
  const generateDefaultPlanets = useCallback(() => {
    const planets: Planet[] = [];
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#ffeaa7",
      "#dda0dd",
    ];

    const planetImages = [
      "https://cdn.builder.io/api/v1/image/assets%2Ff94d2a386a444693b9fbdff90d783a66%2Fdfdbc589c3f344eea7b33af316e83b41?format=webp&width=800",
      "https://cdn.builder.io/api/v1/image/assets%2Ff94d2a386a444693b9fbdff90d783a66%2Fd42810aa3d45429d93d8c58c52827326?format=webp&width=800",
      "https://cdn.builder.io/api/v1/image/assets%2Ff94d2a386a444693b9fbdff90d783a66%2Fdfce7132f868407eb4d7afdf27d09a77?format=webp&width=800",
      "https://cdn.builder.io/api/v1/image/assets%2Ff94d2a386a444693b9fbdff90d783a66%2F8e6b96287f6448089ed602d82e2839bc?format=webp&width=800",
      "https://cdn.builder.io/api/v1/image/assets%2Ff94d2a386a444693b9fbdff90d783a66%2F7a1b7c8172a5446b9a22ffd65d22a6f7?format=webp&width=800",
      "https://cdn.builder.io/api/v1/image/assets%2Ff94d2a386a444693b9fbdff90d783a66%2F76c4f943e6e045938d8e5efb84a2a969?format=webp&width=800",
    ];

    const planetNames = [
      "Estaç��o Galáctica",
      "Base Orbital",
      "Mundo Alienígena",
      "Terra Verdejante",
      "Reino Gelado",
      "Vila Ancestral",
    ];

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 250;
      planets.push({
        id: `planet-${i}`,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
        size: 60,
        rotation: 0,
        color: colors[i],
        name: planetNames[i],
        interactionRadius: 90,
        imageUrl: planetImages[i],
      });
    }

    // Preload planet images
    planetImages.forEach((imageUrl, index) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        planetImagesRef.current.set(`planet-${index}`, img);
      };
    });

    planetsRef.current = planets;
  }, []);

  // Load ship image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src =
      "https://cdn.builder.io/api/v1/image/assets%2F927080298e954d2fba85d9a91618627d%2Fd89cbfd7d2604752a995652efb832852?format=webp&width=800";
    img.onload = () => {
      shipImageRef.current = img;
    };
  }, []);

  // Initialize game objects once
  useEffect(() => {
    generateRichStarField();
    loadWorldPositions();
  }, [generateRichStarField, loadWorldPositions]);

  // Update planets when worldPositions from store change
  useEffect(() => {
    updatePlanetsFromStore();
  }, [updatePlanetsFromStore]);

  // Reload world positions when component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Reload world positions when tab becomes active again
        loadWorldPositions();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadWorldPositions]);

  // Save any pending changes when component unmounts
  useEffect(() => {
    return () => {
      // Clear any pending timeouts and save immediately if editing
      const timeouts = [
        (window as any).worldDragTimeout,
        (window as any).worldSizeTimeout,
        (window as any).worldRotationTimeout,
        (window as any).worldInteractionTimeout,
      ];

      timeouts.forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });

      if (selectedWorldId) {
        const planet = planetsRef.current.find((p) => p.id === selectedWorldId);
        if (planet) {
          // Save immediately on unmount
          updateWorldPosition(selectedWorldId, {
            x: planet.x,
            y: planet.y,
            size: planet.size,
            rotation: planet.rotation,
            interactionRadius: planet.interactionRadius,
          });
        }
      }
    };
  }, [selectedWorldId]);

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
      if (user?.isAdmin && isWorldEditMode && isDragging && selectedWorldId) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const worldX =
          newMousePos.x - centerX + gameState.camera.x - dragOffset.x;
        const worldY =
          newMousePos.y - centerY + gameState.camera.y - dragOffset.y;

        // Update world position immediately for responsive feedback
        planetsRef.current = planetsRef.current.map((planet) =>
          planet.id === selectedWorldId
            ? { ...planet, x: worldX, y: worldY }
            : planet,
        );

        // Save to database with throttling
        clearTimeout((window as any).worldDragTimeout);
        (window as any).worldDragTimeout = setTimeout(() => {
          console.log("���� Saving world drag position:", {
            selectedWorldId,
            worldX,
            worldY,
          });
          updateWorldPosition(selectedWorldId, {
            x: worldX,
            y: worldY,
          });
        }, 200);
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

  // Handle shooting and world editing
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || isLandingAnimationActive) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Convert click position to world coordinates
      const worldClickX = clickX - centerX + gameState.camera.x;
      const worldClickY = clickY - centerY + gameState.camera.y;

      // World editing mode
      if (user?.isAdmin && isWorldEditMode) {
        let worldClicked = false;

        planetsRef.current.forEach((planet) => {
          const dx = getWrappedDistance(planet.x, worldClickX);
          const dy = getWrappedDistance(planet.y, worldClickY);
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= planet.size) {
            // Se já está selecionado e dragging, pare o drag
            if (selectedWorldId === planet.id && isDragging) {
              setIsDragging(false);
              setDragOffset({ x: 0, y: 0 });
            } else if (selectedWorldId === planet.id && !isDragging) {
              // Se já est���� selecionado mas não dragging, inicie o drag
              setIsDragging(true);
              setDragOffset({ x: dx, y: dy });
            } else {
              // Selecione novo mundo
              setSelectedWorldId(planet.id);
              setIsDragging(false);
            }
            worldClicked = true;
          }
        });

        // Clique fora de qualquer mundo - desseleciona tudo
        if (!worldClicked) {
          setSelectedWorldId(null);
          setIsDragging(false);
          setDragOffset({ x: 0, y: 0 });
        }
        return;
      }

      // Check if click was on a planet first
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
        shootProjectile();
      }
    },
    [
      gameState,
      getWrappedDistance,
      isClickOnPlanetPixel,
      isWorldEditMode,
      isLandingAnimationActive,
      user?.isAdmin,
      shootProjectile,
      updateWorldPosition,
      setSelectedPlanet,
      setShowLandingModal,
    ],
  );

  // Handle mouse up to stop dragging
  // Handler para mousedown - inicia tiro contínuo
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isLandingAnimationActive) return;

      if (!user?.isAdmin || !isWorldEditMode) {
        setIsMousePressed(true);

        // Primeiro tiro imediato
        shootProjectile();

        // Iniciar timer para tiros contínuos
        if (shootingIntervalRef.current) {
          clearInterval(shootingIntervalRef.current);
        }

        shootingIntervalRef.current = setInterval(() => {
          shootProjectile();
        }, 333); // 3 tiros por segundo
      }
    },
    [user?.isAdmin, isWorldEditMode, shootProjectile, isLandingAnimationActive],
  );

  const handleMouseUp = useCallback(() => {
    // Parar tiro contínuo
    setIsMousePressed(false);
    if (shootingIntervalRef.current) {
      clearInterval(shootingIntervalRef.current);
      shootingIntervalRef.current = null;
    }

    // Lógica original de edição de mundos
    if (user?.isAdmin && isWorldEditMode && isDragging && selectedWorldId) {
      const planet = planetsRef.current.find((p) => p.id === selectedWorldId);
      if (planet) {
        updateWorldPosition(selectedWorldId, {
          x: planet.x,
          y: planet.y,
        });
      }

      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [user?.isAdmin, isWorldEditMode, isDragging, selectedWorldId]);

  // Handle ESC key to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && user?.isAdmin && isWorldEditMode) {
        setSelectedWorldId(null);
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user?.isAdmin, isWorldEditMode]);

  // Modal handlers
  const handleLandingConfirm = useCallback(() => {
    if (selectedPlanet) {
      // Start landing animation
      setLandingAnimationData({
        planet: selectedPlanet,
        startTime: performance.now(),
        duration: 2500, // 2.5 seconds animation
        initialShipX: gameState.ship.x,
        initialShipY: gameState.ship.y,
      });
      setIsLandingAnimationActive(true);

      // Play landing sound
      playLandingSound().catch(() => {
        // Sound is not critical, ignore errors
      });
    }
    setShowLandingModal(false);
    setSelectedPlanet(null);
  }, [selectedPlanet, gameState.ship.x, gameState.ship.y]);

  const handleLandingCancel = useCallback(() => {
    setShowLandingModal(false);
    setSelectedPlanet(null);
    // Force reset mouse state to ensure ship responds immediately
    hasMouseMoved.current = true;
    setMouseInWindow(true);
  }, []);

  // Cleanup do timer de tiro quando componente desmonta
  useEffect(() => {
    return () => {
      if (shootingIntervalRef.current) {
        clearInterval(shootingIntervalRef.current);
        shootingIntervalRef.current = null;
      }
    };
  }, []);

  // Parar tiro quando mouse sai da área do canvas
  const handleMouseLeaveCanvas = useCallback(() => {
    setIsMousePressed(false);
    if (shootingIntervalRef.current) {
      clearInterval(shootingIntervalRef.current);
      shootingIntervalRef.current = null;
    }
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

        // Only respond to mouse if it has actually moved and modal is not open and not landing
        if (
          hasMouseMoved.current &&
          !showLandingModal &&
          !isLandingAnimationActive
        ) {
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

        // Apply physics only when not landing
        if (!isLandingAnimationActive) {
          // Apply less friction when mouse is outside window to maintain momentum
          const currentFriction = mouseInWindow ? FRICTION : 0.995;
          newState.ship.vx *= currentFriction;
          newState.ship.vy *= currentFriction;
          newState.ship.x += newState.ship.vx;
          newState.ship.y += newState.ship.vy;

          newState.ship.x = normalizeCoord(newState.ship.x);
          newState.ship.y = normalizeCoord(newState.ship.y);
        }

        return newState;
      });

      // Create trail points after ship position update
      const currentShipVelocity = Math.sqrt(
        gameState.ship.vx * gameState.ship.vx +
          gameState.ship.vy * gameState.ship.vy,
      );

      // Continuous movement sound control
      const velocityThreshold = 0.05;
      const isShipMoving = currentShipVelocity > velocityThreshold;

      if (isShipMoving && !movementSoundActiveRef.current) {
        // Start continuous movement sound
        startContinuousMovementSound();
        movementSoundActiveRef.current = true;
      } else if (!isShipMoving && movementSoundActiveRef.current) {
        // Stop continuous movement sound
        stopContinuousMovementSound();
        movementSoundActiveRef.current = false;
      }

      // Update sound parameters in real-time when moving
      if (movementSoundActiveRef.current) {
        updateContinuousMovementSound(currentShipVelocity, SHIP_MAX_SPEED);
      }

      // Only create trail points if ship is moving and enough time has passed
      if (
        currentShipVelocity > 0.1 &&
        currentTime - lastTrailTime.current > 35
      ) {
        createTrailPoint(
          gameState.ship.x,
          gameState.ship.y,
          currentTime,
          currentShipVelocity,
        );
        lastTrailTime.current = currentTime;
      }

      // Update trail points
      updateTrailPoints(deltaTime);

      // Continue with game state update
      setGameState((prevState) => {
        const newState = { ...prevState };

        // Camera follows ship (use current ship position for landing animation)
        const targetX =
          isLandingAnimationActive && landingAnimationData
            ? (function () {
                const currentTime = performance.now();
                const elapsed = currentTime - landingAnimationData.startTime;
                const progress = Math.min(
                  elapsed / landingAnimationData.duration,
                  1,
                );
                const planet = landingAnimationData.planet;
                const initialDx = landingAnimationData.initialShipX - planet.x;
                const initialDy = landingAnimationData.initialShipY - planet.y;
                const initialRadius = Math.sqrt(
                  initialDx * initialDx + initialDy * initialDy,
                );
                const orbitSpeed = 1;
                const initialAngle = Math.atan2(initialDy, initialDx);
                const angleProgress =
                  initialAngle + progress * orbitSpeed * Math.PI * 2;
                const currentRadius = initialRadius * (1 - progress * 0.9);
                return planet.x + Math.cos(angleProgress) * currentRadius;
              })()
            : newState.ship.x;

        const targetY =
          isLandingAnimationActive && landingAnimationData
            ? (function () {
                const currentTime = performance.now();
                const elapsed = currentTime - landingAnimationData.startTime;
                const progress = Math.min(
                  elapsed / landingAnimationData.duration,
                  1,
                );
                const planet = landingAnimationData.planet;
                const initialDx = landingAnimationData.initialShipX - planet.x;
                const initialDy = landingAnimationData.initialShipY - planet.y;
                const initialRadius = Math.sqrt(
                  initialDx * initialDx + initialDy * initialDy,
                );
                const orbitSpeed = 1;
                const initialAngle = Math.atan2(initialDy, initialDx);
                const angleProgress =
                  initialAngle + progress * orbitSpeed * Math.PI * 2;
                const currentRadius = initialRadius * (1 - progress * 0.9);
                return planet.y + Math.sin(angleProgress) * currentRadius;
              })()
            : newState.ship.y;

        const cameraFollowSpeed = 0.08;
        const deltaX = getWrappedDistance(targetX, newState.camera.x);
        const deltaY = getWrappedDistance(targetY, newState.camera.y);

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

      // Update projectiles with delta time
      const currentFrameTime = performance.now();
      const projectileDeltaTime =
        (currentFrameTime - lastFrameTimeRef.current) / 1000; // Convert to seconds
      lastFrameTimeRef.current = currentFrameTime;

      projectilesRef.current = projectilesRef.current
        .map((proj) => ({
          ...proj,
          x: normalizeCoord(proj.x + proj.vx * projectileDeltaTime),
          y: normalizeCoord(proj.y + proj.vy * projectileDeltaTime),
          life: proj.life - projectileDeltaTime,
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

      // Render barrier circle (rotating, gray, transparent)
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
      ctx.globalAlpha = 0.15; // Muito transparente
      ctx.strokeStyle = "#888888"; // Cinza
      ctx.lineWidth = 2;

      // Rotaç��o lenta baseada no tempo
      const rotationTime = currentTime * 0.0005; // Muito lenta
      const dashOffset = (rotationTime * 50) % 20; // Offset dos traços para simular rotação

      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -dashOffset; // Anima os traços
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

        // Always render planets regardless of viewport position
        {
          // Check if ship is within interaction radius for visual feedback
          const shipToPlanetX = getWrappedDistance(planet.x, gameState.ship.x);
          const shipToPlanetY = getWrappedDistance(planet.y, gameState.ship.y);
          const shipToPlanetDistance = Math.sqrt(
            shipToPlanetX * shipToPlanetX + shipToPlanetY * shipToPlanetY,
          );
          const isInRange = shipToPlanetDistance <= planet.interactionRadius;
          const isSelected =
            user?.isAdmin && isWorldEditMode && selectedWorldId === planet.id;

          // Render interaction circle (only visible to admins)
          if (user?.isAdmin) {
            ctx.save();
            if (isWorldEditMode) {
              // Edit mode styling
              ctx.globalAlpha = isSelected ? 0.8 : 0.3;
              ctx.strokeStyle = isSelected ? "#ffff00" : "#ffffff";
              ctx.lineWidth = isSelected ? 4 : 2;
              ctx.setLineDash(isSelected ? [] : [8, 8]);
            } else {
              // Normal mode styling
              ctx.globalAlpha = isInRange ? 0.4 : 0.15;
              ctx.strokeStyle = isInRange ? "#00ff00" : "#ffffff";
              ctx.lineWidth = isInRange ? 3 : 1;
              ctx.setLineDash(isInRange ? [] : [5, 5]);
            }
            ctx.beginPath();
            ctx.arc(screenX, screenY, planet.interactionRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Render planet image with rotation
          const img = planetImagesRef.current.get(planet.id);
          if (img && img.complete) {
            ctx.save();
            ctx.globalAlpha = 1;

            // Apply rotation if planet has rotation
            if (planet.rotation && planet.rotation !== 0) {
              ctx.translate(screenX, screenY);
              ctx.rotate(planet.rotation);
              ctx.translate(-screenX, -screenY);
            }

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

      // Render projectiles as bright energy beams
      projectilesRef.current.forEach((proj) => {
        const wrappedDeltaX = getWrappedDistance(proj.x, gameState.camera.x);
        const wrappedDeltaY = getWrappedDistance(proj.y, gameState.camera.y);
        const screenX = centerX + wrappedDeltaX;
        const screenY = centerY + wrappedDeltaY;

        ctx.save();

        const lifeRatio = proj.life / proj.maxLife;
        const angle = Math.atan2(proj.vy, proj.vx);
        const length = 8;
        const time = Date.now() * 0.01; // Para efeito pulsante
        const pulse = 0.8 + 0.2 * Math.sin(time);

        // Calcular pontos da linha do tracinho
        const endX = screenX + Math.cos(angle) * length;
        const endY = screenY + Math.sin(angle) * length;

        // Glow externo mais sutil (aura de energia amarela mais fraca)
        ctx.globalAlpha = lifeRatio * 0.2 * pulse;
        ctx.strokeStyle = "#e6c200";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.shadowColor = "#e6c200";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Glow médio amarelo-dourado mais suave
        ctx.globalAlpha = lifeRatio * 0.5;
        ctx.strokeStyle = "#f0d633";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Core energético amarelo mais suave
        ctx.globalAlpha = lifeRatio * 0.7 * pulse;
        ctx.strokeStyle = "#f5e033";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#f5e033";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Centro brilhante amarelo-branco mais sutil
        ctx.globalAlpha = lifeRatio * 0.8;
        ctx.strokeStyle = "#f8f8cc";
        ctx.lineWidth = 1;
        ctx.shadowColor = "#f8f8cc";
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Reset shadow para não afetar outros elementos
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        ctx.restore();
      });

      // Render shooting stars
      shootingStarsRef.current.forEach((shootingStar) => {
        drawShootingStar(ctx, shootingStar);
      });

      // Render ship trail before ship (so trail appears behind ship)
      let shipWorldX = gameState.ship.x;
      let shipWorldY = gameState.ship.y;

      // Handle landing animation for trail positioning
      if (isLandingAnimationActive && landingAnimationData) {
        const currentTime = performance.now();
        const elapsed = currentTime - landingAnimationData.startTime;
        const progress = Math.min(elapsed / landingAnimationData.duration, 1);

        if (progress < 1) {
          const planet = landingAnimationData.planet;
          const initialDx = landingAnimationData.initialShipX - planet.x;
          const initialDy = landingAnimationData.initialShipY - planet.y;
          const initialRadius = Math.sqrt(
            initialDx * initialDx + initialDy * initialDy,
          );
          const orbitSpeed = 1;
          const initialAngle = Math.atan2(initialDy, initialDx);
          const angleProgress =
            initialAngle + progress * orbitSpeed * Math.PI * 2;
          const currentRadius = initialRadius * (1 - progress * 0.9);

          shipWorldX = planet.x + Math.cos(angleProgress) * currentRadius;
          shipWorldY = planet.y + Math.sin(angleProgress) * currentRadius;

          // Create trail points during landing animation with proportional intensity
          if (currentTime - lastTrailTime.current > 35) {
            // Calculate orbital velocity for proportional trail intensity
            const orbitalSpeed =
              (2 * Math.PI * currentRadius) / landingAnimationData.duration;
            const normalizedOrbitalSpeed = Math.min(
              orbitalSpeed / (SHIP_MAX_SPEED * 300),
              1,
            );
            const landingIntensity = Math.max(normalizedOrbitalSpeed, 0.4); // Minimum intensity for visibility

            createTrailPoint(
              shipWorldX,
              shipWorldY,
              currentTime,
              landingIntensity,
            );
            lastTrailTime.current = currentTime;
          }
        }
      }

      const shipWrappedDeltaX = getWrappedDistance(
        shipWorldX,
        gameState.camera.x,
      );
      const shipWrappedDeltaY = getWrappedDistance(
        shipWorldY,
        gameState.camera.y,
      );
      const shipScreenX = centerX + shipWrappedDeltaX;
      const shipScreenY = centerY + shipWrappedDeltaY;

      // Draw the trail
      drawShipTrail(ctx, shipScreenX, shipScreenY, shipWorldX, shipWorldY);

      // Render ship (with landing animation support)
      let shipScale = 1;
      let shipAngle = gameState.ship.angle;

      // Handle landing animation
      if (isLandingAnimationActive && landingAnimationData) {
        const currentTime = performance.now();
        const elapsed = currentTime - landingAnimationData.startTime;
        const progress = Math.min(elapsed / landingAnimationData.duration, 1);

        if (progress >= 1) {
          // Animation complete - set final position at planet and hide ship
          shipWorldX = landingAnimationData.planet.x;
          shipWorldY = landingAnimationData.planet.y;
          shipScale = 0; // Hide the ship immediately

          // Update the game state to keep ship at planet position
          setGameState((prevState) => ({
            ...prevState,
            ship: {
              ...prevState.ship,
              x: landingAnimationData.planet.x,
              y: landingAnimationData.planet.y,
              vx: 0,
              vy: 0,
            },
          }));

          // Use setTimeout to delay the transition, preventing the ship from appearing at center
          setTimeout(() => {
            setIsLandingAnimationActive(false);
            setLandingAnimationData(null);
            setCurrentPlanet(landingAnimationData.planet);
            setCurrentScreen("planet");
          }, 100); // Brief delay to ensure smooth transition
        } else {
          // Calculate orbital animation
          const planet = landingAnimationData.planet;

          // Calculate initial distance from player to planet
          const initialDx = landingAnimationData.initialShipX - planet.x;
          const initialDy = landingAnimationData.initialShipY - planet.y;
          const initialRadius = Math.sqrt(
            initialDx * initialDx + initialDy * initialDy,
          );

          const orbitSpeed = 1; // Only 1 orbit per animation

          // Calculate initial angle based on player's starting position relative to planet
          const initialAngle = Math.atan2(initialDy, initialDx);

          const angleProgress =
            initialAngle + progress * orbitSpeed * Math.PI * 2;

          // Gradually spiral inward from initial radius to planet center
          const currentRadius = initialRadius * (1 - progress * 0.9); // Spiral 90% closer

          // Calculate orbital position around planet
          shipWorldX = planet.x + Math.cos(angleProgress) * currentRadius;
          shipWorldY = planet.y + Math.sin(angleProgress) * currentRadius;

          // Ship points in trajectory direction (tangent to the orbit)
          shipAngle = angleProgress + Math.PI / 2; // Tangent is perpendicular to radius

          // Scale down as landing progresses, becoming completely invisible
          shipScale = Math.max(0, 1 - progress * 1.2); // Ship becomes completely invisible
        }
      }

      ctx.save();
      ctx.translate(shipScreenX, shipScreenY);
      ctx.rotate(shipAngle);
      ctx.scale(shipScale, shipScale);
      ctx.globalAlpha = 1;

      // Render ship image if loaded, otherwise fallback to original drawing
      if (shipImageRef.current && shipImageRef.current.complete) {
        const shipSize = 40; // Adjust size as needed
        ctx.drawImage(
          shipImageRef.current,
          -shipSize / 2,
          -shipSize / 2,
          shipSize,
          shipSize,
        );
      } else {
        // Fallback to original ship drawing
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
      }

      ctx.restore();
      ctx.globalAlpha = 1;

      // Render radar pulses
      radarPulsesRef.current.forEach((pulse) => {
        drawRadarPulse(
          ctx,
          pulse,
          shipScreenX,
          shipScreenY,
          shipWorldX,
          shipWorldY,
        );
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      // Stop continuous movement sound when component unmounts
      if (movementSoundActiveRef.current) {
        stopContinuousMovementSound();
        movementSoundActiveRef.current = false;
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
    isLandingAnimationActive,
    landingAnimationData,
    setCurrentPlanet,
    setCurrentScreen,
    createTrailPoint,
    updateTrailPoints,
    drawShipTrail,
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
          cursor:
            user?.isAdmin && isWorldEditMode
              ? isDragging
                ? "grabbing"
                : "grab"
              : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='3' fill='%230080ff' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E") 8 8, auto`,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={(e) => {
          handleMouseLeave(e);
          handleMouseLeaveCanvas();
        }}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />

      {/* Simple Admin Button for World Editing */}
      {user?.isAdmin && (
        <div className="absolute top-2 right-2 space-y-2">
          <button
            onClick={() => {
              setWorldEditMode(!isWorldEditMode);
              if (isWorldEditMode) {
                setSelectedWorldId(null);
                setIsDragging(false);
              }
            }}
            className={`block w-full px-3 py-1 text-xs rounded-lg font-medium transition-all ${
              isWorldEditMode
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isWorldEditMode ? "Sair Edição" : "Editar Mundos"}
          </button>
        </div>
      )}

      {/* World Controls when selected */}
      {user?.isAdmin && isWorldEditMode && selectedWorldId && (
        <div className="absolute top-14 right-2 bg-white rounded-lg p-3 shadow-lg border border-gray-200 w-64">
          <h4 className="text-sm font-bold text-gray-900 mb-3">
            Mundo:{" "}
            {planetsRef.current.find((p) => p.id === selectedWorldId)?.name}
          </h4>

          {/* Size Control */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tamanho:{" "}
              {planetsRef.current.find((p) => p.id === selectedWorldId)?.size ||
                60}
            </label>
            <input
              type="range"
              min="20"
              max="1000"
              value={
                planetsRef.current.find((p) => p.id === selectedWorldId)
                  ?.size || 60
              }
              onChange={async (e) => {
                const newSize = Number(e.target.value);

                // Update immediately for responsive feedback
                planetsRef.current = planetsRef.current.map((planet) =>
                  planet.id === selectedWorldId
                    ? {
                        ...planet,
                        size: newSize,
                        interactionRadius: Math.max(90, newSize + 30),
                      }
                    : planet,
                );

                // Save to database with throttling to avoid too many calls
                clearTimeout((window as any).worldSizeTimeout);
                (window as any).worldSizeTimeout = setTimeout(async () => {
                  if (selectedWorldId) {
                    console.log("📏 Attempting to save world size:", {
                      selectedWorldId,
                      newSize,
                    });
                    console.log("📏 Saving world size:", {
                      selectedWorldId,
                      newSize,
                    });
                    updateWorldPosition(selectedWorldId, {
                      size: newSize,
                    });
                  }
                }, 300);
              }}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Rotation Control */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Rotação:{" "}
              {Math.round(
                ((planetsRef.current.find((p) => p.id === selectedWorldId)
                  ?.rotation || 0) *
                  180) /
                  Math.PI,
              )}
              ��
            </label>
            <input
              type="range"
              min="0"
              max={Math.PI * 2}
              step="0.1"
              value={
                planetsRef.current.find((p) => p.id === selectedWorldId)
                  ?.rotation || 0
              }
              onChange={async (e) => {
                const newRotation = Number(e.target.value);

                // Update immediately for responsive feedback
                planetsRef.current = planetsRef.current.map((planet) =>
                  planet.id === selectedWorldId
                    ? { ...planet, rotation: newRotation }
                    : planet,
                );

                // Save to database with throttling to avoid too many calls
                clearTimeout((window as any).worldRotationTimeout);
                (window as any).worldRotationTimeout = setTimeout(() => {
                  if (selectedWorldId) {
                    console.log("�� Saving world rotation:", {
                      selectedWorldId,
                      newRotation,
                    });
                    updateWorldPosition(selectedWorldId, {
                      rotation: newRotation,
                    });
                  }
                }, 300);
              }}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Interaction Radius Control */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ����rea de Pouso:{" "}
              {Math.round(
                planetsRef.current.find((p) => p.id === selectedWorldId)
                  ?.interactionRadius || 90,
              )}
              px
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="5"
              value={
                planetsRef.current.find((p) => p.id === selectedWorldId)
                  ?.interactionRadius || 90
              }
              onChange={(e) => {
                const newRadius = Number(e.target.value);

                // Update local state immediately
                planetsRef.current = planetsRef.current.map((planet) =>
                  planet.id === selectedWorldId
                    ? { ...planet, interactionRadius: newRadius }
                    : planet,
                );

                // Save to store with throttling
                clearTimeout((window as any).worldInteractionTimeout);
                (window as any).worldInteractionTimeout = setTimeout(() => {
                  if (selectedWorldId) {
                    console.log("🎯 Saving interaction radius:", {
                      selectedWorldId,
                      newRadius,
                    });
                    updateWorldPosition(selectedWorldId, {
                      interactionRadius: newRadius,
                    });
                  }
                }, 300);
              }}
              className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex space-x-2 mt-3">
            <button
              onClick={() => {
                setIsDragging(true);
                setDragOffset({ x: 0, y: 0 });
              }}
              className={`flex-1 px-2 py-1 text-xs rounded ${
                isDragging
                  ? "bg-red-100 text-red-700 border border-red-300"
                  : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
              }`}
              disabled={isDragging}
            >
              {isDragging ? "Arrastando..." : "Mover Mundo"}
            </button>

            {isDragging && (
              <button
                onClick={() => {
                  // Save final position
                  if (selectedWorldId) {
                    const planet = planetsRef.current.find(
                      (p) => p.id === selectedWorldId,
                    );
                    if (planet) {
                      console.log("✅ Confirming world position:", {
                        selectedWorldId,
                        x: planet.x,
                        y: planet.y,
                      });
                      updateWorldPosition(selectedWorldId, {
                        x: planet.x,
                        y: planet.y,
                      });
                    }
                  }

                  setIsDragging(false);
                  setDragOffset({ x: 0, y: 0 });
                }}
                className="flex-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
              >
                Confirmar
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            ✅ Alterações salvas automaticamente
            <br />
            ESC para cancelar • Clique fora para desselecionar
          </p>
        </div>
      )}

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
        {user?.isAdmin && isWorldEditMode ? (
          <>
            <div className="text-yellow-400 font-bold mb-1">
              ��� MODO EDIÇÃO
            </div>
            <div>�� 1º Click: Selecionar mundo</div>
            <div>
              • 2º Click: {isDragging ? "Confirmar posição" : "Ativar arrastar"}
            </div>
            <div>• ESC: Cancelar</div>
            <div>• Painel: Tamanho/Rotação</div>
          </>
        ) : (
          <>
            <div>• Mouse: Mover nave</div>
            <div>• Click: Atirar/Planeta</div>
          </>
        )}
      </div>
    </div>
  );
};
