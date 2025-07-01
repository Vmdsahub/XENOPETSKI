import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  motion,
  useMotionValue,
  animate,
  AnimatePresence,
} from "framer-motion";
import { PlayerShip } from "./PlayerShip";
import {
  playBarrierCollisionSound,
  playAutoPilotActivationSound,
  startEngineSound,
  stopEngineSound,
} from "../../utils/soundManager";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";
import { gameService, GalaxyWorld } from "../../services/gameService";
import { useBackgroundMusic } from "../../hooks/useBackgroundMusic";

interface GalaxyMapProps {}

// Sistema simples de pontos
interface Point {
  id: string | number;
  x: number;
  y: number;
  label: string;
  image: string;
  type: string;
  scale?: number;
  rotation?: number;
}

// Converter GalaxyWorld para Point
const galaxyWorldToPoint = (world: GalaxyWorld): Point => ({
  id: world.id,
  x: world.x,
  y: world.y,
  label: world.name,
  image: world.imageUrl,
  type: "world",
  scale: world.scale,
  rotation: world.rotation || 0,
});

// 7 pontos distribuídos em c��rculo ao redor do centro
const createDefaultPoints = (): Point[] => {
  const centerX = 50;
  const centerY = 50;
  const radius = 20;

  const pointData = [
    {
      label: "Gaia Selvagem",
      type: "forest",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fbd58c52f19d147f09ff36547a19e0305?format=webp&width=1600",
    },
    {
      label: "Mundo Gelado",
      type: "ice",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fea3ec3d920794634bdf7d66a1159511b?format=webp&width=1600",
    },
    {
      label: "Reino Desértico",
      type: "desert",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F7066e87a53b34231ac837e59befecf75?format=webp&width=1600",
    },
    {
      label: "Aldeia Pacífica",
      type: "village",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F02782c34d2cd4353a884ab021ce35173?format=webp&width=1600",
    },
    {
      label: "Dimens��o Alienígena",
      type: "alien",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Facb3e8e8eb33422a88b01594f5d1c470?format=webp&width=1600",
    },
    {
      label: "Estação Mineradora",
      type: "station",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F213c17a38e9545088415b03b5c9e9319?format=webp&width=1600",
    },
    {
      label: "Estação Orbital",
      type: "orbital",
      image:
        "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F5df1481617e34873b681fc3061c5a759?format=webp&width=1600",
    },
  ];

  const points: Point[] = [];

  // Posições bem espaçadas para garantir que todas as 7 ilhas sejam visíveis
  const positions = [
    { x: 30, y: 30 }, // Gaia Selvagem
    { x: 50, y: 25 }, // Mundo Gelado
    { x: 70, y: 30 }, // Reino Desértico
    { x: 25, y: 50 }, // Aldeia Pacífica
    { x: 75, y: 50 }, // Dimensão Alienígena
    { x: 35, y: 70 }, // Estação Mineradora
    { x: 65, y: 70 }, // Estação Orbital
  ];

  for (let i = 0; i < 7; i++) {
    points.push({
      id: i + 1,
      x: positions[i].x,
      y: positions[i].y,
      label: pointData[i].label,
      type: pointData[i].type,
      image: pointData[i].image,
      scale: 1,
    });
  }

  return points;
};

// Configura��ão simplificada do mundo toroidal
const WORLD_CONFIG = {
  width: 200, // Tamanho do mundo em %
  height: 200,
} as const;

// Função wrap para coordenadas toroidais
const wrap = (value: number, min: number, max: number): number => {
  const range = max - min;
  if (range <= 0) return min;

  let result = value;
  while (result < min) result += range;
  while (result >= max) result -= range;
  return result;
};

export const GalaxyMap: React.FC<GalaxyMapProps> = () => {
  const { user } = useAuthStore();
  const { setCurrentScreen, setSelectedWorld } = useGameStore();
  const isAdmin = user?.username === "Vitoca";

  // Debug log
  useEffect(() => {
    console.log("🔍 Debug - User:", user?.username, "isAdmin:", isAdmin);
  }, [user, isAdmin]);

  // Background music for galactic navigation
  const { play: playMusic, pause: pauseMusic } = useBackgroundMusic();

  // Load points from database or use localStorage fallback
  const [points, setPoints] = useState<Point[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(true);

  // Load galaxy worlds from database
  useEffect(() => {
    const loadGalaxyWorlds = async () => {
      try {
        setIsLoadingWorlds(true);
        const worlds = await gameService.getGalaxyWorlds();

        if (worlds.length > 0) {
          // Use database data
          const worldPoints = worlds.map(galaxyWorldToPoint);
          setPoints(worldPoints);
          console.log("🌌 Mundos carregados do banco:", worlds);
        } else {
          // Fallback to localStorage or create defaults
          const saved = localStorage.getItem("xenopets-galaxy-points");
          if (saved) {
            try {
              const savedPoints = JSON.parse(saved);
              setPoints(
                savedPoints.map((point: Point) => ({
                  ...point,
                  scale: point.scale || 1,
                })),
              );
              console.log("💾 Usando dados do localStorage como fallback");
            } catch (e) {
              console.warn("Erro ao carregar pontos salvos:", e);
              setPoints(createDefaultPoints());
            }
          } else {
            const defaultPoints = createDefaultPoints();
            setPoints(defaultPoints);
            console.log("��� Usando pontos padrão");
          }
        }
      } catch (error) {
        console.error("Erro ao carregar mundos da galáxia:", error);
        // Use localStorage fallback on error
        const saved = localStorage.getItem("xenopets-galaxy-points");
        if (saved) {
          try {
            const savedPoints = JSON.parse(saved);
            setPoints(
              savedPoints.map((point: Point) => ({
                ...point,
                scale: point.scale || 1,
              })),
            );
          } catch (e) {
            setPoints(createDefaultPoints());
          }
        } else {
          setPoints(createDefaultPoints());
        }
      } finally {
        setIsLoadingWorlds(false);
      }
    };

    loadGalaxyWorlds();
  }, []);

  // Cleanup music when component unmounts
  useEffect(() => {
    return () => {
      console.log("🔇 Pausando música ao sair do mapa");
      pauseMusic().catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [pauseMusic]);

  const [shipPosition, setShipPosition] = useState(() => {
    const saved = localStorage.getItem("xenopets-player-data");
    const data = saved
      ? JSON.parse(saved)
      : { ship: { x: 50, y: 50 }, map: { x: 0, y: 0 } };
    console.log("💾 Dados carregados do localStorage:", { saved, data });
    return data.ship;
  });

  // Drag states for points
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingPoint, setResizingPoint] = useState<number | null>(null);
  const [resizeStartScale, setResizeStartScale] = useState<number>(1);
  const [resizeStartY, setResizeStartY] = useState<number>(0);
  const [rotatingPoint, setRotatingPoint] = useState<number | null>(null);
  const [rotateStartRotation, setRotateStartRotation] = useState<number>(0);
  const [rotateStartAngle, setRotateStartAngle] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Refs para acessar estados atuais nos event listeners
  const resizingPointRef = useRef<number | null>(null);
  const rotatingPointRef = useRef<number | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const [collisionNotification, setCollisionNotification] = useState<{
    show: boolean;
    id: number;
  }>({ show: false, id: 0 });

  // Estados para o modo auto-piloto
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [autoPilotDirection, setAutoPilotDirection] = useState({ x: 0, y: 0 });
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [currentMousePos, setCurrentMousePos] = useState({ x: 0, y: 0 });

  // Estados para a nave navegante
  const [showShipModal, setShowShipModal] = useState(false);
  const [typewriterText1, setTypewriterText1] = useState("");
  const [typewriterText2, setTypewriterText2] = useState("");
  const [showTypewriter2, setShowTypewriter2] = useState(false);
  const [alienText1, setAlienText1] = useState("");
  const [alienText2, setAlienText2] = useState("");

  // Textos completos do diálogo
  const fullText1 =
    '"Olá, viajante! Sou o Capitão Zyx. Navego por estas rotas comerciais há décadas, transportando recursos entre os planetas do sistema."';
  const fullText2 =
    '"Precisa de alguma coisa? Tenho suprimentos frescos de todas as dimensões!"';

  // Função para gerar caracteres alienígenas aleatórios
  const generateAlienChar = () => {
    const alienChars = [
      "⟨",
      "⟩",
      "⟪",
      "⟫",
      "⟦",
      "⟧",
      "⟴",
      "⟵",
      "⟶",
      "⟷",
      "⟸",
      "⟹",
      "⟺",
      "⟻",
      "⟼",
      "⟽",
      "⟾",
      "⟿",
      "⥀",
      "⥁",
      "⥂",
      "⥃",
      "⥄",
      "⥅",
      "⥆",
      "⥇",
      "⥈",
      "⥉",
      "⥊",
      "⥋",
      "◊",
      "⧫",
      "⬟",
      "⬠",
      "⬡",
      "⬢",
      "⬣",
      "⬤",
      "⬥",
      "⬦",
      "⬧",
      "⬨",
      "⬩",
      "⬪",
      "⬫",
      "⬬",
      "⬭",
      "⬮",
      "⬯",
      "∀",
      "∁",
      "∂",
      "∃",
      "∄",
      "∅",
      "∆",
      "∇",
      "∈",
      "��",
      "∊",
      "∋",
      "∌",
      "∍",
      "���",
      "∏",
      "∐",
      "∑",
      "−",
      "∓",
      "∔",
      "∕",
      "∖",
      "∗",
      "∘",
      "∙",
      "√",
      "∛",
      "∜",
      "∝",
      "∞",
      "∟",
      "∠",
      "∡",
      "∢",
      "∣",
      "∤",
      "∥",
      "∦",
      "∧",
      "∨",
      "∩",
      "∪",
      "∫",
      "∬",
      "∭",
      "∮",
      "∯",
      "∰",
      "∱",
      "∲",
      "∳",
      "∴",
      "∵",
      "∶",
      "∷",
      "∸",
      "∹",
      "∺",
      "∻",
      "∼",
      "∽",
      "∾",
      "∿",
      "≀",
      "≁",
      "≂",
      "≃",
      "≄",
      "≅",
      "≆",
      "���",
      "≈",
      "≉",
      "≊",
      "≋",
      "≌",
      "≍",
      "≎",
      "≏",
      "≐",
      "≑",
      "≒",
      "≓",
      "≔",
      "≕",
      "≖",
      "≗",
      "≘",
      "≙",
      "≚",
      "≛",
      "≜",
      "≝",
      "≞",
      "≟",
    ];
    return alienChars[Math.floor(Math.random() * alienChars.length)];
  };

  // Fun��ão para gerar texto alienígena baseado no comprimento
  const generateAlienText = (length: number) => {
    return Array.from({ length }, () => generateAlienChar()).join("");
  };

  // Efeito typewriter com tradução alienígena
  useEffect(() => {
    if (showShipModal) {
      // Reset dos textos quando modal abre
      setTypewriterText1("");
      setTypewriterText2("");
      setAlienText1("");
      setAlienText2("");
      setShowTypewriter2(false);

      // Primeira frase
      let index1 = 0;
      const timer1 = setInterval(() => {
        if (index1 < fullText1.length) {
          const currentChar = fullText1[index1];
          const alienChar = generateAlienChar();

          // Primeiro mostra o caractere alienígena na posição correta
          setTypewriterText1(fullText1.slice(0, index1) + alienChar);

          // Depois de 40ms, substitui pelo caractere real
          setTimeout(() => {
            setTypewriterText1(fullText1.slice(0, index1 + 1));
          }, 40);

          index1++;
        } else {
          clearInterval(timer1);
          // Pausa antes da segunda frase
          setTimeout(() => {
            setShowTypewriter2(true);
            // Segunda frase
            let index2 = 0;
            const timer2 = setInterval(() => {
              if (index2 < fullText2.length) {
                const currentChar = fullText2[index2];
                const alienChar = generateAlienChar();

                // Primeiro mostra o caractere alienígena na posição correta
                setTypewriterText2(fullText2.slice(0, index2) + alienChar);

                // Depois de 40ms, substitui pelo caractere real
                setTimeout(() => {
                  setTypewriterText2(fullText2.slice(0, index2 + 1));
                }, 40);

                index2++;
              } else {
                clearInterval(timer2);
              }
            }, 50); // 50ms por caractere para segunda frase
          }, 800); // Pausa de 800ms entre frases
        }
      }, 30); // 30ms por caractere para primeira frase

      return () => {
        clearInterval(timer1);
      };
    }
  }, [showShipModal]);
  const [wanderingShip, setWanderingShip] = useState({
    x: 50, // posição relativa na barreira
    y: 45,
    velocityX: 0, // velocidade atual em X
    velocityY: 0, // velocidade atual em Y
    rotation: 0,
    baseSpeed: 0.15, // velocidade reduzida para movimento mais suave
    maxSpeed: 0.3, // velocidade máxima reduzida
    direction: Math.random() * Math.PI * 2, // direção atual em radianos
    targetDirection: Math.random() * Math.PI * 2, // direção alvo
    directionChangeTimer: 0,
    nextDirectionChange: 300 + Math.random() * 600, // 5-15 segundos para próxima mudança
    isMoving: true,
    distanceToPlayer: 100,
    // Sistema de pausas nos mundos
    isPaused: false,
    pauseTimer: 0,
    nearestWorldDistance: 100,
    hasRecentlyPaused: false,
    pauseCooldown: 0,
    // Sistema de comportamento inteligente
    behavior: "free", // "free", "approaching", "orbiting", "leaving"
    behaviorTimer: 0,
    nextBehaviorChange: 1800 + Math.random() * 1200, // 30-50 segundos
    targetPlanet: null,
    orbitRadius: 15,
    orbitAngle: 0,
    orbitSpeed: 0.02,
    approachDistance: 18,
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values para posi��ão do mapa (movimento inverso da nave)
  const getInitialMapPosition = () => {
    const saved = localStorage.getItem("xenopets-player-data");
    const data = saved
      ? JSON.parse(saved)
      : { ship: { x: 50, y: 50 }, map: { x: 0, y: 0 } };
    return data.map;
  };

  const initialMapPos = getInitialMapPosition();
  const mapX = useMotionValue(initialMapPos.x);
  const mapY = useMotionValue(initialMapPos.y);
  const shipRotation = useMotionValue(0);
  // Sistema de rotação suave
  const targetRotation = useRef(0);
  const lastRotationUpdate = useRef(0);

  // Estados para momentum/inércia
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [isDecelerating, setIsDecelerating] = useState(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(Date.now());
  const [hasMoved, setHasMoved] = useState(false);

  // Canvas ref para estrelas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Refs para auto-piloto
  const autoPilotAnimationRef = useRef<number>();
  const holdTimeoutRef = useRef<number>();

  // Sistema de estrelas cadentes
  const shootingStarsRef = useRef<
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      tailLength: number;
      angle: number;
      startTime: number;
    }[]
  >([]);
  const lastShootingStarTime = useRef(0);

  // Sistema de estrelas corrigido para escala -5000 a +5000
  const starData = useMemo(() => {
    const colors = [
      "#60A5FA",
      "#F87171",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#FB7185",
    ];

    const createStar = (seed: number, layerType: "bg" | "mid" | "fg") => {
      // Função hash simples e efetiva
      const hash = (n: number) => {
        let h = n * 2654435761;
        h = h ^ (h >> 16);
        h = h * 2654435761;
        h = h ^ (h >> 16);
        return (h >>> 0) / 4294967296;
      };

      const baseConfig = {
        bg: {
          sizeMin: 0.3,
          sizeMax: 0.8,
          opacityMin: 0.1,
          opacityMax: 0.4,
          speed: 0.08,
        },
        mid: {
          sizeMin: 0.6,
          sizeMax: 1.2,
          opacityMin: 0.2,
          opacityMax: 0.6,
          speed: 0.25,
        },
        fg: {
          sizeMin: 1.0,
          sizeMax: 2.0,
          opacityMin: 0.4,
          opacityMax: 0.9,
          speed: 0.5,
        },
      }[layerType];

      // Escala real do mapa: -5000 a +5000 = 10000 unidades
      // Expandimos para 20000 unidades para ter estrelas suficientes
      const MAP_SCALE = 20000;

      return {
        x: (hash(seed * 11) - 0.5) * MAP_SCALE,
        y: (hash(seed * 13) - 0.5) * MAP_SCALE,
        size:
          baseConfig.sizeMin +
          hash(seed * 17) * (baseConfig.sizeMax - baseConfig.sizeMin),
        opacity:
          baseConfig.opacityMin +
          hash(seed * 19) * (baseConfig.opacityMax - baseConfig.opacityMin),
        color:
          layerType === "fg" && hash(seed * 23) > 0.7
            ? colors[Math.floor(hash(seed * 29) * colors.length)]
            : "#ffffff",
        speed: baseConfig.speed,
        isColorful: layerType === "fg" && hash(seed * 23) > 0.7,
      };
    };

    return {
      background: Array.from({ length: 1500 }, (_, i) =>
        createStar(i + 1000, "bg"),
      ),
      middle: Array.from({ length: 800 }, (_, i) =>
        createStar(i + 2000, "mid"),
      ),
      foreground: Array.from({ length: 300 }, (_, i) =>
        createStar(i + 3000, "fg"),
      ),
      parallax: Array.from({ length: 150 }, (_, i) =>
        createStar(i + 4000, "fg"),
      ),
    };
  }, []);

  // Posição da nave em ref para evitar re-renders
  const shipPosRef = useRef(shipPosition);

  // Atualiza ref quando state muda
  useEffect(() => {
    shipPosRef.current = shipPosition;
  }, [shipPosition]);

  // Debug: log das posições iniciais
  useEffect(() => {
    console.log("🚀 Posição inicial da nave:", shipPosition);
    console.log("��️ Posição inicial do mapa:", {
      x: mapX.get(),
      y: mapY.get(),
    });
  }, []);

  // Sistema de geração de estrelas cadentes
  const createShootingStar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const colors = [
      "#60A5FA", // Blue
      "#F87171", // Red
      "#34D399", // Green
      "#FBBF24", // Yellow
      "#A78BFA", // Purple
      "#FB7185", // Pink
      "#10B981", // Emerald
      "#F59E0B", // Amber
      "#8B5CF6", // Violet
      "#06B6D4", // Cyan
    ];

    // Propriedades aleatórias para cada estrela cadente
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4; // Velocidade entre 2-6
    const size = 0.4 + Math.random() * 0.6; // Tamanho entre 0.4-1.0 (menores)
    const life = 60 + Math.random() * 120; // Vida entre 1-3 segundos a 60fps
    const tailLength = 12 + Math.random() * 18; // Comprimento da cauda (reduzido)

    // Posição inicial fora da tela
    const margin = 100;
    let startX, startY;

    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: // Top
        startX = Math.random() * (canvas.width + 2 * margin) - margin;
        startY = -margin;
        break;
      case 1: // Right
        startX = canvas.width + margin;
        startY = Math.random() * (canvas.height + 2 * margin) - margin;
        break;
      case 2: // Bottom
        startX = Math.random() * (canvas.width + 2 * margin) - margin;
        startY = canvas.height + margin;
        break;
      default: // Left
        startX = -margin;
        startY = Math.random() * (canvas.height + 2 * margin) - margin;
        break;
    }

    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: life,
      maxLife: life,
      size: size,
      color: colors[Math.floor(Math.random() * colors.length)],
      tailLength: tailLength,
      angle: angle,
      startTime: Date.now(),
    };
  }, []);

  const updateShootingStars = useCallback(
    (currentTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Gera novas estrelas cadentes ocasionalmente
      if (
        currentTime - lastShootingStarTime.current >
        2000 + Math.random() * 4000
      ) {
        const newStar = createShootingStar();
        if (newStar) {
          shootingStarsRef.current.push(newStar);
          lastShootingStarTime.current = currentTime;
        }
      }

      // Atualiza estrelas cadentes existentes
      shootingStarsRef.current = shootingStarsRef.current.filter((star) => {
        // Animação baseada em seno para movimento fluido
        const timeDelta = (currentTime - star.startTime) * 0.001; // Converte para segundos
        const sineWave = Math.sin(timeDelta * 3) * 0.3; // Ondulação suave

        // Aplica movimento com ondulação
        star.x += star.vx + sineWave * Math.cos(star.angle + Math.PI / 2);
        star.y += star.vy + sineWave * Math.sin(star.angle + Math.PI / 2);

        star.life--;

        // Remove estrelas que saíram da tela ou acabou a vida
        return (
          star.life > 0 &&
          star.x > -200 &&
          star.x < canvas.width + 200 &&
          star.y > -200 &&
          star.y < canvas.height + 200
        );
      });
    },
    [createShootingStar],
  );

  const renderShootingStars = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      shootingStarsRef.current.forEach((star) => {
        const opacity = Math.min(1, (star.life / star.maxLife) * 1.2); // Mais luminosas
        const timeDelta = (currentTime - star.startTime) * 0.001;

        // Animaç����o de tamanho baseada em seno
        const sizeVariation = 1 + Math.sin(timeDelta * 8) * 0.3; // Pulso mais intenso
        const currentSize = star.size * sizeVariation;

        // Desenha a cauda da estrela cadente
        const tailPoints = [];
        for (let i = 0; i < star.tailLength; i++) {
          const progress = i / star.tailLength;
          const tailOpacity = opacity * (1 - progress) * 0.7;

          tailPoints.push({
            x: star.x - star.vx * progress * 3,
            y: star.y - star.vy * progress * 3,
            opacity: tailOpacity,
            size: currentSize * (1 - progress * 0.8),
          });
        }

        // Renderiza a cauda
        tailPoints.forEach((point, index) => {
          if (point.opacity > 0.01) {
            const gradient = ctx.createRadialGradient(
              point.x,
              point.y,
              0,
              point.x,
              point.y,
              point.size * 3,
            );
            gradient.addColorStop(
              0,
              star.color +
                Math.floor(point.opacity * 255)
                  .toString(16)
                  .padStart(2, "0"),
            );
            gradient.addColorStop(
              0.6,
              star.color +
                Math.floor(point.opacity * 128)
                  .toString(16)
                  .padStart(2, "0"),
            );
            gradient.addColorStop(1, star.color + "00");

            ctx.globalAlpha = point.opacity;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, point.size * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Desenha o núcleo brilhante da estrela
        const coreGradient = ctx.createRadialGradient(
          star.x,
          star.y,
          0,
          star.x,
          star.y,
          currentSize * 5,
        );
        coreGradient.addColorStop(0, "#FFFFFF");
        coreGradient.addColorStop(0.2, star.color);
        coreGradient.addColorStop(0.5, star.color + "BB");
        coreGradient.addColorStop(1, star.color + "00");

        ctx.globalAlpha = Math.min(1, opacity * 1.3);
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(star.x, star.y, currentSize * 5, 0, Math.PI * 2);
        ctx.fill();

        // Núcleo interno mais brilhante
        ctx.globalAlpha = Math.min(1, opacity * 1.5);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(star.x, star.y, currentSize * 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
    },
    [],
  );

  // Renderização das estrelas parallax (acima do jogador)
  const renderParallaxStars = useCallback(() => {
    const canvas = parallaxCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentMapX = mapX.get();
    const currentMapY = mapY.get();
    const parallaxSpeed = 2.5; // Parallax muito mais forte
    const cameraX = -currentMapX * parallaxSpeed;
    const cameraY = -currentMapY * parallaxSpeed;

    // Função hash para gerar posições consistentes
    const hash = (x: number, y: number, layer: number) => {
      let h = 1779033703 ^ layer;
      h = Math.imul(h ^ Math.floor(x), 3432918353);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h ^ Math.floor(y), 461845907);
      h = (h << 13) | (h >>> 19);
      return (h >>> 0) / 4294967296;
    };

    // Gera mais estrelas, mas ainda espaçadas
    const margin = 100;
    const startX = Math.floor((cameraX - margin) / 120) * 120; // Células um pouco menores = mais estrelas
    const endX = Math.ceil((cameraX + canvas.width + margin) / 120) * 120;
    const startY = Math.floor((cameraY - margin) / 120) * 120;
    const endY = Math.ceil((cameraY + canvas.height + margin) / 120) * 120;

    const time = Date.now() * 0.001; // Para animação de piscar

    for (let gx = startX; gx < endX; gx += 120) {
      for (let gy = startY; gy < endY; gy += 120) {
        const cellHash = hash(gx, gy, 5);

        // Máximo 1 estrela por célula, chance de 75%
        if (cellHash > 0.25) {
          const starHash = hash(gx + 137, gy + 241, 5);
          const starHash2 = hash(gx + 173, gy + 197, 6);

          const localX = starHash * 120;
          const localY = starHash2 * 120;

          const worldX = gx + localX;
          const worldY = gy + localY;

          const screenX = worldX - cameraX;
          const screenY = worldY - cameraY;

          if (
            screenX >= -10 &&
            screenX <= canvas.width + 10 &&
            screenY >= -10 &&
            screenY <= canvas.height + 10
          ) {
            const opacityHash = hash(worldX * 1.7, worldY * 1.9, 5);
            const colorHash = hash(worldX * 2.1, worldY * 2.3, 5);
            const blinkHash = hash(worldX * 3.1, worldY * 4.3, 5);
            const floatHash = hash(worldX * 2.7, worldY * 3.1, 5);
            const floatHash2 = hash(worldX * 4.1, worldY * 2.9, 5);

            // Pontinhos pequenos: 0.8px a 1.5px
            const size = 0.8 + opacityHash * 0.7;

            // Animação de piscar baseada no hash ��nico de cada estrela
            const blinkSpeed = 1.5 + blinkHash * 2; // Velocidades diferentes
            const blinkOffset = blinkHash * Math.PI * 2; // Fases diferentes
            const blinkFactor =
              0.3 + 0.7 * (1 + Math.sin(time * blinkSpeed + blinkOffset)) * 0.5;

            // Movimento de flutuação como poeira cósmica
            const floatSpeedX = 0.8 + floatHash * 1.2; // Velocidades mais rápidas para X
            const floatSpeedY = 0.6 + floatHash2 * 1.0; // Velocidades mais rápidas para Y
            const floatOffsetX = floatHash * Math.PI * 2; // Fases diferentes
            const floatOffsetY = floatHash2 * Math.PI * 2;

            // Movimento mais visível de flutuação (3-8 pixels de amplitude)
            const floatAmplitudeX = 3.0 + floatHash * 5.0;
            const floatAmplitudeY = 2.5 + floatHash2 * 5.5;

            const floatX =
              Math.sin(time * floatSpeedX + floatOffsetX) * floatAmplitudeX;
            const floatY =
              Math.cos(time * floatSpeedY + floatOffsetY) * floatAmplitudeY;

            // Posição final com flutuaç��o
            const finalX = screenX + floatX;
            const finalY = screenY + floatY;

            // Opacidade base baixa com piscar
            const baseOpacity = 0.4 + opacityHash * 0.3;
            const finalOpacity = baseOpacity * blinkFactor;

            // Só algumas estrelas coloridas (20%)
            const isColorful = colorHash > 0.8;
            const colors = ["#60a5fa", "#fbbf24", "#ffffff"];
            const color = isColorful
              ? colors[Math.floor(colorHash * colors.length)]
              : "#ffffff";

            ctx.globalAlpha = finalOpacity;
            ctx.fillStyle = color;

            // Apenas pontinhos simples, sem gradientes
            ctx.beginPath();
            ctx.arc(finalX, finalY, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ctx.globalAlpha = 1;
  }, [mapX, mapY]);

  // Geração dinâmica de estrelas baseada na posição da câmera
  const renderStarsCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const currentMapX = mapX.get();
    const currentMapY = mapY.get();

    // Tempo atual para anima��ões
    const currentTime = Date.now() * 0.001; // Converte para segundos

    const colors = [
      "#60A5FA",
      "#F87171",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#FB7185",
    ];

    // Fun��ão hash robusta
    const hash = (x: number, y: number, layer: number) => {
      let h = 1779033703 ^ layer;
      h = Math.imul(h ^ Math.floor(x), 3432918353);
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h ^ Math.floor(y), 461845907);
      h = (h << 13) | (h >>> 19);
      return (h >>> 0) / 4294967296;
    };

    // Gera estrelas dinamicamente baseado na região visível
    const generateLayer = (density: number, speed: number, layer: number) => {
      // Calcula posi��ão da câmera com parallax
      const cameraX = -currentMapX * speed;
      const cameraY = -currentMapY * speed;

      // Área visível expandida
      const margin = 200;
      const startX = Math.floor((cameraX - margin) / 50) * 50;
      const endX = Math.ceil((cameraX + canvasWidth + margin) / 50) * 50;
      const startY = Math.floor((cameraY - margin) / 50) * 50;
      const endY = Math.ceil((cameraY + canvasHeight + margin) / 50) * 50;

      // Gera estrelas em grades não-uniformes
      for (let gx = startX; gx < endX; gx += 50) {
        for (let gy = startY; gy < endY; gy += 50) {
          const cellHash = hash(gx, gy, layer);

          // Número de estrelas nesta célula (0-density)
          const numStars = Math.floor(cellHash * density);

          for (let i = 0; i < numStars; i++) {
            const starHash = hash(gx + i * 137, gy + i * 241, layer + i);
            const starHash2 = hash(
              gx + i * 173,
              gy + i * 197,
              layer + i + 1000,
            );

            // Posição dentro da célula (completamente aleatória)
            const localX = starHash * 50;
            const localY = starHash2 * 50;

            const worldX = gx + localX;
            const worldY = gy + localY;

            // Converte para coordenadas do canvas
            const screenX = worldX - cameraX;
            const screenY = worldY - cameraY;

            // Só renderiza se visível
            if (
              screenX >= -10 &&
              screenX <= canvasWidth + 10 &&
              screenY >= -10 &&
              screenY <= canvasHeight + 10
            ) {
              // Propriedades da estrela
              const sizeHash = hash(worldX * 1.1, worldY * 1.3, layer);
              const opacityHash = hash(worldX * 1.7, worldY * 1.9, layer);
              const colorHash = hash(worldX * 2.1, worldY * 2.3, layer);

              // Hash para animações únicas de cada estrela
              const animationSeed = hash(worldX * 3.7, worldY * 4.1, layer);
              const animationSeed2 = hash(worldX * 5.3, worldY * 6.7, layer);

              const baseSize =
                layer === 1
                  ? 0.3 + sizeHash * 0.5
                  : layer === 2
                    ? 0.6 + sizeHash * 0.6
                    : 1.0 + sizeHash * 1.0;

              const baseOpacity =
                layer === 1
                  ? 0.1 + opacityHash * 0.3
                  : layer === 2
                    ? 0.2 + opacityHash * 0.4
                    : 0.4 + opacityHash * 0.5;

              // Animação de piscar - diferentes frequências para cada estrela
              const blinkSpeed = 0.5 + animationSeed * 1.5; // Velocidade entre 0.5 e 2.0
              const blinkPhase = animationSeed * Math.PI * 2; // Fase inicial aleatória
              const blinkIntensity = 0.3 + animationSeed2 * 0.4; // Intensidade entre 0.3 e 0.7
              const blinkFactor =
                1 +
                Math.sin(currentTime * blinkSpeed + blinkPhase) *
                  blinkIntensity;

              // Animação de movimento flutuante
              const floatSpeedX = (animationSeed - 0.5) * 0.8; // Velocidade entre -0.4 e 0.4
              const floatSpeedY = (animationSeed2 - 0.5) * 0.6; // Velocidade entre -0.3 e 0.3
              const floatPhaseX = animationSeed * Math.PI * 4;
              const floatPhaseY = animationSeed2 * Math.PI * 4;
              const floatRange = layer === 1 ? 0.3 : layer === 2 ? 0.5 : 0.8; // Movimento maior para estrelas maiores

              const floatOffsetX =
                Math.sin(currentTime * floatSpeedX + floatPhaseX) * floatRange;
              const floatOffsetY =
                Math.cos(currentTime * floatSpeedY + floatPhaseY) * floatRange;

              const animatedSize = baseSize * blinkFactor;
              const animatedOpacity = Math.min(1, baseOpacity * blinkFactor);
              const animatedX = screenX + floatOffsetX;
              const animatedY = screenY + floatOffsetY;

              const isColorful = layer === 3 && colorHash > 0.8;
              const color = isColorful
                ? colors[Math.floor(colorHash * colors.length)]
                : "#ffffff";

              ctx.globalAlpha = animatedOpacity;
              ctx.fillStyle = color;

              if (isColorful) {
                const gradient = ctx.createRadialGradient(
                  animatedX,
                  animatedY,
                  0,
                  animatedX,
                  animatedY,
                  animatedSize * 2.5,
                );
                gradient.addColorStop(0, color);
                gradient.addColorStop(0.4, color + "77");
                gradient.addColorStop(1, color + "00");
                ctx.fillStyle = gradient;

                ctx.beginPath();
                ctx.arc(
                  animatedX,
                  animatedY,
                  animatedSize * 2.5,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();

                ctx.fillStyle = color;
              }

              ctx.beginPath();
              ctx.arc(animatedX, animatedY, animatedSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    };

    // Renderiza camadas
    generateLayer(8, 0.08, 1); // Background
    generateLayer(4, 0.25, 2); // Middle
    generateLayer(2, 0.5, 3); // Foreground
    generateLayer(3, 0.8, 4); // Parallax - camada acima do jogador

    // Atualiza e renderiza estrelas cadentes
    updateShootingStars(Date.now());
    renderShootingStars(ctx, Date.now());

    ctx.globalAlpha = 1;
  }, [mapX, mapY, updateShootingStars, renderShootingStars]);

  // Sistema de animação otimizado para Canvas
  useEffect(() => {
    const animate = () => {
      renderStarsCanvas();
      renderParallaxStars();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Limpa estrelas cadentes ao desmontar
      shootingStarsRef.current = [];
    };
  }, [renderStarsCanvas]);

  // Atualiza canvas size quando container muda
  useEffect(() => {
    const canvas = canvasRef.current;
    const parallaxCanvas = parallaxCanvasRef.current;
    const container = containerRef.current;

    if (!canvas || !parallaxCanvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      parallaxCanvas.width = rect.width;
      parallaxCanvas.height = rect.height;
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Sistema de momentum/in����rcia
  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  // Sistema de rotação suave
  useEffect(() => {
    let animationId: number;

    const smoothRotation = () => {
      const currentAngle = shipRotation.get();
      const target = targetRotation.current;

      // Normaliza ângulos
      let normalizedCurrent = ((currentAngle % 360) + 360) % 360;
      let normalizedTarget = ((target % 360) + 360) % 360;

      // Calcula diferença angular pelo caminho mais curto
      let diff = normalizedTarget - normalizedCurrent;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      // Interpolação suave fixa
      const newAngle = currentAngle + diff * 0.15;

      shipRotation.set(newAngle);

      animationId = requestAnimationFrame(smoothRotation);
    };

    animationId = requestAnimationFrame(smoothRotation);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [shipRotation]);

  // Sincronizar refs com estados
  useEffect(() => {
    resizingPointRef.current = resizingPoint;
  }, [resizingPoint]);

  useEffect(() => {
    rotatingPointRef.current = rotatingPoint;
  }, [rotatingPoint]);

  // Tecla Esc para sair dos modos de edição
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (resizingPointRef.current !== null) {
          setResizingPoint(null);
          setResizeStartScale(1);
          setResizeStartY(0);
        }
        if (rotatingPointRef.current !== null) {
          setRotatingPoint(null);
          setRotateStartRotation(0);
          setRotateStartAngle(0);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Função para repelir o jogador
  const repelPlayer = useCallback(
    (collisionX: number, collisionY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Calcula direção da repuls��o (do centro da barreira para fora)
      const repelDirectionX = collisionX - centerX;
      const repelDirectionY = collisionY - centerY;
      const distance = Math.sqrt(
        repelDirectionX * repelDirectionX + repelDirectionY * repelDirectionY,
      );

      if (distance > 0) {
        // Normaliza a direç���o e aplica força de repuls����o
        const normalizedX = repelDirectionX / distance;
        const normalizedY = repelDirectionY / distance;
        const repelForce = 15; // For��a da repulsão

        // Para o movimento atual imediatamente
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);

        // Aplica repulsão ao mapa (movimento inverso)
        const currentMapX = mapX.get();
        const currentMapY = mapY.get();

        animate(mapX, currentMapX - normalizedX * repelForce, {
          duration: 0.3,
          ease: "easeOut",
        });
        animate(mapY, currentMapY - normalizedY * repelForce, {
          duration: 0.3,
          ease: "easeOut",
        });

        // Atualiza posição da nave correspondentemente
        const repelShipX = (normalizedX * repelForce) / 12;
        const repelShipY = (normalizedY * repelForce) / 12;

        setShipPosition((prev) => ({
          x: wrap(prev.x + repelShipX, 0, WORLD_CONFIG.width),
          y: wrap(prev.y + repelShipY, 0, WORLD_CONFIG.height),
        }));
      }
    },
    [mapX, mapY],
  );

  // Função para mostrar notifica��ão de colisão local
  const showCollisionNotification = useCallback(() => {
    const notificationId = Date.now();
    setCollisionNotification({ show: true, id: notificationId });

    // Remove a notificação após 4 segundos
    setTimeout(() => {
      setCollisionNotification((prev) =>
        prev.id === notificationId ? { show: false, id: 0 } : prev,
      );
    }, 4000);
  }, []);

  // Função para verificar colisão apenas na borda visual da barreira circular
  const checkBarrierCollision = useCallback(
    (proposedMapX: number, proposedMapY: number) => {
      // Raio exato da barreira visual: 2400px diâmetro = 1200px raio
      const barrierRadius = 1200;

      // Calcula a distância do centro (0,0) no sistema de coordenadas do mapa visual
      const distanceFromCenter = Math.sqrt(
        proposedMapX * proposedMapX + proposedMapY * proposedMapY,
      );

      // Só detecta colisão bem próximo da borda visual (1190-1220px)
      // Permite navegar até quase tocar a linha tracejada
      if (distanceFromCenter > 1190 && distanceFromCenter <= 1220) {
        const canvas = canvasRef.current;
        if (!canvas) return { isColliding: true, collisionPoint: null };

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Calcula o ponto exato de colisão na borda da barreira
        const angle = Math.atan2(proposedMapY, proposedMapX);

        // Ponto de colisão na borda da barreira (em coordenadas de tela)
        const collisionX = centerX + Math.cos(angle) * barrierRadius;
        const collisionY = centerY + Math.sin(angle) * barrierRadius;

        return {
          isColliding: true,
          collisionPoint: { x: collisionX, y: collisionY },
        };
      }

      // Dentro da barreira ou muito longe = sem colisão
      return { isColliding: false, collisionPoint: null };
    },
    [],
  );

  // Função para atualizar dire����ão do auto-piloto baseada na posição do mouse
  const updateAutoPilotDirection = useCallback(
    (mouseX: number, mouseY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Converte coordenadas do mouse para posi��ão relativa ao canvas
      const relativeMouseX = mouseX - rect.left;
      const relativeMouseY = mouseY - rect.top;

      const dirX = relativeMouseX - centerX;
      const dirY = relativeMouseY - centerY;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);

      if (length > 0) {
        setAutoPilotDirection({
          x: dirX / length,
          y: dirY / length,
        });
      }
    },
    [],
  );

  // Sistema de auto-piloto que segue o mouse constantemente
  useEffect(() => {
    if (!isAutoPilot) return;

    let animationId: number;

    const autoPilotMovement = () => {
      const speed = 1.8; // Velocidade reduzida para melhor controle
      const deltaX = autoPilotDirection.x * speed;
      const deltaY = autoPilotDirection.y * speed;

      // Calcula nova posição proposta
      const proposedX = wrap(
        shipPosRef.current.x - deltaX / 12,
        0,
        WORLD_CONFIG.width,
      );
      const proposedY = wrap(
        shipPosRef.current.y - deltaY / 12,
        0,
        WORLD_CONFIG.height,
      );

      // Verifica colisão com barreira usando coordenadas do mapa visual
      const currentMapX = mapX.get();
      const currentMapY = mapY.get();
      const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
      const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
      const proposedMapX = currentMapX + deltaMapX;
      const proposedMapY = currentMapY + deltaMapY;

      const collision = checkBarrierCollision(proposedMapX, proposedMapY);
      if (collision.isColliding) {
        // Para o auto-piloto em caso de colisão
        setIsAutoPilot(false);
        setIsColliding(true);
        setTimeout(() => setIsColliding(false), 200);
        if (collision.collisionPoint) {
          repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
        }
        playBarrierCollisionSound();
        showCollisionNotification();
        return;
      }

      // Atualiza posição
      setShipPosition({ x: proposedX, y: proposedY });

      // Atualiza mapa visual
      const newMapX = mapX.get() + deltaX;
      const newMapY = mapY.get() + deltaY;

      mapX.set(newMapX);
      mapY.set(newMapY);

      // Atualiza rotação da nave para seguir a direção
      const angle =
        Math.atan2(-autoPilotDirection.y, -autoPilotDirection.x) *
          (180 / Math.PI) +
        90;
      targetRotation.current = angle;

      animationId = requestAnimationFrame(autoPilotMovement);
    };

    animationId = requestAnimationFrame(autoPilotMovement);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [
    isAutoPilot,
    autoPilotDirection,
    mapX,
    mapY,
    checkBarrierCollision,
    repelPlayer,
    showCollisionNotification,
  ]);

  // Sistema de rastreamento do mouse/touch durante auto-piloto
  useEffect(() => {
    if (!isAutoPilot) return;

    const handleMouseMove = (e: MouseEvent) => {
      setCurrentMousePos({ x: e.clientX, y: e.clientY });
      updateAutoPilotDirection(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        setCurrentMousePos({ x: touch.clientX, y: touch.clientY });
        updateAutoPilotDirection(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isAutoPilot, updateAutoPilotDirection]);

  // Sistema de momentum mais suave usando interpola���ão
  useEffect(() => {
    if (
      !isDragging &&
      !isAutoPilot &&
      (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001)
    ) {
      setIsDecelerating(true);

      let animationId: number;

      const applyMomentum = () => {
        const currentVel = velocityRef.current;
        const friction = 0.995; // Atrito muito suave para deslizamento longo

        // Para quando velocidade fica muito baixa
        if (Math.abs(currentVel.x) < 0.001 && Math.abs(currentVel.y) < 0.001) {
          setIsDecelerating(false);
          setVelocity({ x: 0, y: 0 });
          return;
        }

        const newVelX = currentVel.x * friction;
        const newVelY = currentVel.y * friction;

        // Movimento ainda mais suave para evitar saltos
        const deltaX = newVelX * 1.5; // Movimento mapa reduzido
        const deltaY = newVelY * 1.5;

        // Calcula nova posição proposta para momentum
        const proposedX = wrap(
          shipPosRef.current.x - deltaX / 20, // Divisão maior para movimento mais suave
          0,
          WORLD_CONFIG.width,
        );
        const proposedY = wrap(
          shipPosRef.current.y - deltaY / 20,
          0,
          WORLD_CONFIG.height,
        );

        // Verifica colisão com barreira usando coordenadas do mapa visual
        let newX = proposedX;
        let newY = proposedY;

        const currentMapX = mapX.get();
        const currentMapY = mapY.get();
        const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
        const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
        const proposedMapX = currentMapX + deltaMapX;
        const proposedMapY = currentMapY + deltaMapY;

        const collision = checkBarrierCollision(proposedMapX, proposedMapY);
        if (collision.isColliding) {
          // Ativa flash vermelho
          setIsColliding(true);
          setTimeout(() => setIsColliding(false), 200); // Flash de 0.2 segundos
          if (collision.collisionPoint) {
            repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
          }
          // Reproduz som de colisão
          playBarrierCollisionSound();
          // Mostra notificação
          showCollisionNotification();
          setIsDecelerating(false);
          setVelocity({ x: 0, y: 0 });
          return;
        }

        setShipPosition({ x: newX, y: newY });

        // Mapa visual move de forma muito suave
        const newMapX = mapX.get() + deltaX;
        const newMapY = mapY.get() + deltaY;

        mapX.set(newMapX);
        mapY.set(newMapY);

        setVelocity({ x: newVelX, y: newVelY });

        animationId = requestAnimationFrame(applyMomentum);
      };

      animationId = requestAnimationFrame(applyMomentum);

      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }
  }, [
    isDragging,
    isAutoPilot,
    mapX,
    mapY,
    checkBarrierCollision,
    repelPlayer,
    showCollisionNotification,
  ]);

  // Função para calcular distância toroidal correta
  const getToroidalDistance = (
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ) => {
    // Calcula diferen��as considerando wrap em mundo toroidal
    const dx1 = Math.abs(pos1.x - pos2.x);
    const dx2 = WORLD_CONFIG.width - dx1;
    const minDx = Math.min(dx1, dx2);

    const dy1 = Math.abs(pos1.y - pos2.y);
    const dy2 = WORLD_CONFIG.height - dy1;
    const minDy = Math.min(dy1, dy2);

    return Math.sqrt(minDx * minDx + minDy * minDy);
  };

  // Salva posi��ão - simples
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDragging && !isAutoPilot) {
        localStorage.setItem(
          "xenopets-player-data",
          JSON.stringify({
            ship: shipPosRef.current,
            map: { x: mapX.get(), y: mapY.get() },
          }),
        );
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isDragging, isAutoPilot]);

  // Sistema de mouse nativo mais confiável
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Sistema de progresso do hold melhorado
  useEffect(() => {
    if (!isHolding || !holdStartTime) return;

    let animationId: number;

    const updateProgress = () => {
      const elapsed = Date.now() - holdStartTime;
      const progress = Math.min(elapsed / 2500, 1); // 2.5 segundos
      setHoldProgress(progress);

      if (progress >= 1) {
        // Ativa auto-piloto
        setIsAutoPilot(true);
        setIsHolding(false);
        setHoldProgress(0);
        setHoldStartTime(null);
        // Reproduz som de ativação
        playAutoPilotActivationSound();
      } else if (isHolding) {
        animationId = requestAnimationFrame(updateProgress);
      }
    };

    animationId = requestAnimationFrame(updateProgress);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isHolding, holdStartTime]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAutoPilot) {
      setIsAutoPilot(false);
      return;
    }

    // Não inicia drag do mapa se estiver arrastando um ponto, redimensionando ou rotacionando
    if (
      draggingPoint !== null ||
      resizingPoint !== null ||
      rotatingPoint !== null
    )
      return;

    setIsDragging(true);
    setHasMoved(false);
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    // Inicia o timer para auto-piloto
    const startTime = Date.now();
    setHoldStartTime(startTime);
    setIsHolding(true);
    setHoldProgress(0);

    // Calcula direção inicial para auto-piloto
    updateAutoPilotDirection(e.clientX, e.clientY);

    e.preventDefault();
  };

  // Touch event handlers para dispositivos móveis
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAutoPilot) {
      setIsAutoPilot(false);
      return;
    }

    // Não inicia drag do mapa se estiver arrastando um ponto, redimensionando ou rotacionando
    if (
      draggingPoint !== null ||
      resizingPoint !== null ||
      rotatingPoint !== null
    )
      return;

    const touch = e.touches[0];
    if (!touch) return;

    setIsDragging(true);
    setHasMoved(false);
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };

    // Inicia o timer para auto-piloto
    const startTime = Date.now();
    setHoldStartTime(startTime);
    setIsHolding(true);
    setHoldProgress(0);

    // Calcula direção inicial para auto-piloto
    updateAutoPilotDirection(touch.clientX, touch.clientY);

    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    // Para o timer de auto-piloto se o mouse se mover
    if (isHolding) {
      setIsHolding(false);
      setHoldProgress(0);
      setHoldStartTime(null);
    }

    const currentTime = Date.now();
    const deltaTime = currentTime - lastMoveTime.current;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    // Momentum suavizado baseado no movimento
    if (deltaTime > 0) {
      const velX = Math.max(-1.5, Math.min(1.5, deltaX * 0.08));
      const velY = Math.max(-1.5, Math.min(1.5, deltaY * 0.08));
      setVelocity({ x: velX, y: velY });
    }

    // Calcula nova posição proposta
    const proposedX = wrap(
      shipPosRef.current.x - deltaX / 12,
      0,
      WORLD_CONFIG.width,
    );
    const proposedY = wrap(
      shipPosRef.current.y - deltaY / 12,
      0,
      WORLD_CONFIG.height,
    );

    // Verifica colisão com barreira usando coordenadas do mapa visual
    let newX = proposedX;
    let newY = proposedY;
    let allowMovement = true;

    const currentMapX = mapX.get();
    const currentMapY = mapY.get();
    const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
    const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
    const proposedMapX = currentMapX + deltaMapX;
    const proposedMapY = currentMapY + deltaMapY;

    const collision = checkBarrierCollision(proposedMapX, proposedMapY);
    if (collision.isColliding) {
      // Ativa flash vermelho
      setIsColliding(true);
      setTimeout(() => setIsColliding(false), 200); // Flash de 0.2 segundos
      if (collision.collisionPoint) {
        repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
      }
      // Reproduz som de colisão
      playBarrierCollisionSound();
      // Mostra notificação
      showCollisionNotification();
      newX = shipPosRef.current.x;
      newY = shipPosRef.current.y;
      allowMovement = false;
      setVelocity({ x: 0, y: 0 });
      setIsDecelerating(false);
    }

    setShipPosition({ x: newX, y: newY });

    // Só atualiza mapa visual se movimento é permitido
    if (allowMovement) {
      // Atualiza mapa visual com wrap
      let newMapX = mapX.get() + deltaX;
      let newMapY = mapY.get() + deltaY;

      // Wrap visual do mapa expandido
      const wrapThreshold = 5000;
      if (newMapX > wrapThreshold) newMapX -= wrapThreshold * 2;
      if (newMapX < -wrapThreshold) newMapX += wrapThreshold * 2;
      if (newMapY > wrapThreshold) newMapY -= wrapThreshold * 2;
      if (newMapY < -wrapThreshold) newMapY += wrapThreshold * 2;

      mapX.set(newMapX);
      mapY.set(newMapY);
    }

    // Rotação responsiva com interpolação suave
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 1) {
      setHasMoved(true);
      const newAngle = Math.atan2(-deltaY, -deltaX) * (180 / Math.PI) + 90;
      targetRotation.current = newAngle;
      lastRotationUpdate.current = Date.now();
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    lastMoveTime.current = currentTime;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;

    // Para o timer de auto-piloto se o touch se mover
    if (isHolding) {
      setIsHolding(false);
      setHoldProgress(0);
      setHoldStartTime(null);
    }

    const currentTime = Date.now();
    const deltaTime = currentTime - lastMoveTime.current;
    const deltaX = touch.clientX - lastMousePos.current.x;
    const deltaY = touch.clientY - lastMousePos.current.y;

    // Momentum suavizado baseado no movimento
    if (deltaTime > 0) {
      const velX = Math.max(-1.5, Math.min(1.5, deltaX * 0.08));
      const velY = Math.max(-1.5, Math.min(1.5, deltaY * 0.08));
      setVelocity({ x: velX, y: velY });
    }

    // Calcula nova posição proposta
    const proposedX = wrap(
      shipPosRef.current.x - deltaX / 12,
      0,
      WORLD_CONFIG.width,
    );
    const proposedY = wrap(
      shipPosRef.current.y - deltaY / 12,
      0,
      WORLD_CONFIG.height,
    );

    // Sistema de detecç��o de colisão
    const collision = checkCollisionWithBarriers(proposedX, proposedY);
    const allowMovement = !collision.isColliding;

    if (collision.isColliding && !isColliding) {
      setIsColliding(true);
      playBarrierCollisionSound();
      showCollisionNotification(collision.nearestPointId);
    } else if (!collision.isColliding && isColliding) {
      setIsColliding(false);
    }

    // Atualiza posição da nave
    const newX = allowMovement ? proposedX : shipPosRef.current.x;
    const newY = allowMovement ? proposedY : shipPosRef.current.y;

    if (newX !== shipPosRef.current.x || newY !== shipPosRef.current.y) {
      setShipPosition({ x: newX, y: newY });
    }

    // S�� atualiza mapa visual se movimento é permitido
    if (allowMovement) {
      // Atualiza mapa visual com wrap
      let newMapX = mapX.get() + deltaX;
      let newMapY = mapY.get() + deltaY;

      // Wrap visual do mapa expandido
      const wrapThreshold = 5000;
      if (newMapX > wrapThreshold) newMapX -= wrapThreshold * 2;
      if (newMapX < -wrapThreshold) newMapX += wrapThreshold * 2;
      if (newMapY > wrapThreshold) newMapY -= wrapThreshold * 2;
      if (newMapY < -wrapThreshold) newMapY += wrapThreshold * 2;

      mapX.set(newMapX);
      mapY.set(newMapY);
    }

    // Rotaç��o responsiva com interpolação suave
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 1) {
      setHasMoved(true);
      const newAngle = Math.atan2(-deltaY, -deltaX) * (180 / Math.PI) + 90;
      targetRotation.current = newAngle;
      lastRotationUpdate.current = Date.now();
    }

    lastMousePos.current = { x: touch.clientX, y: touch.clientY };
    lastMoveTime.current = currentTime;

    e.preventDefault();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsHolding(false);
    setHoldProgress(0);
    setHoldStartTime(null);

    // Se não moveu (apenas clique), para completamente
    if (!hasMoved) {
      setVelocity({ x: 0, y: 0 });
      setIsDecelerating(false);
    }

    localStorage.setItem(
      "xenopets-player-data",
      JSON.stringify({
        ship: shipPosRef.current,
        map: { x: mapX.get(), y: mapY.get() },
      }),
    );
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsHolding(false);
    setHoldProgress(0);
    setHoldStartTime(null);

    // Se não moveu (apenas toque), para completamente
    if (!hasMoved) {
      setVelocity({ x: 0, y: 0 });
      setIsDecelerating(false);
    }

    localStorage.setItem(
      "xenopets-player-data",
      JSON.stringify({
        ship: shipPosRef.current,
        map: { x: mapX.get(), y: mapY.get() },
      }),
    );
  };

  // Mouse events globais para capturar movimento fora do elemento
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Handle point resizing first
      if (isAdmin && resizingPoint !== null) {
        const deltaY = e.clientY - resizeStartY;
        const scaleFactor = 1 + deltaY / 100; // 100px movement = 1x scale change
        const newScale = Math.max(
          0.3,
          Math.min(3, resizeStartScale * scaleFactor),
        );

        const newPoints = points.map((p) =>
          p.id === resizingPoint ? { ...p, scale: newScale } : p,
        );

        setPoints(newPoints);
        return;
      }

      // Handle point rotation
      if (isAdmin && rotatingPoint !== null) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const point = points.find((p) => p.id === rotatingPoint);
        if (!point) return;

        const centerX = (point.x / 100) * rect.width;
        const centerY = (point.y / 100) * rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentAngle =
          Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
        const angleDelta = currentAngle - rotateStartAngle;
        let newRotation = (rotateStartRotation + angleDelta) % 360;

        // Normalize to 0-360 range
        if (newRotation < 0) newRotation += 360;

        const newPoints = points.map((p) =>
          p.id === rotatingPoint ? { ...p, rotation: newRotation } : p,
        );

        setPoints(newPoints);
        return;
      }

      // Handle point dragging
      if (isAdmin && draggingPoint !== null) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left - dragOffset.x;
        const mouseY = e.clientY - rect.top - dragOffset.y;

        // Simple percentage system - no barriers
        const newX = (mouseX / rect.width) * 100;
        const newY = (mouseY / rect.height) * 100;

        const newPoints = points.map((p) =>
          p.id === draggingPoint ? { ...p, x: newX, y: newY } : p,
        );

        setPoints(newPoints);
        return;
      }

      if (!isDragging) return;

      // Para o timer de auto-piloto se o mouse se mover
      if (isHolding) {
        setIsHolding(false);
        setHoldProgress(0);
        setHoldStartTime(null);
      }

      const currentTime = Date.now();
      const deltaTime = currentTime - lastMoveTime.current;
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;

      // Momentum suavizado baseado no movimento
      if (deltaTime > 0) {
        const velX = Math.max(-1.5, Math.min(1.5, deltaX * 0.08));
        const velY = Math.max(-1.5, Math.min(1.5, deltaY * 0.08));
        setVelocity({ x: velX, y: velY });
      }

      // Calcula nova posição proposta
      const proposedX = wrap(
        shipPosRef.current.x - deltaX / 12,
        0,
        WORLD_CONFIG.width,
      );
      const proposedY = wrap(
        shipPosRef.current.y - deltaY / 12,
        0,
        WORLD_CONFIG.height,
      );

      // Verifica colisão com barreira usando coordenadas do mapa visual
      let newX = proposedX;
      let newY = proposedY;
      let allowMovement = true;

      const currentMapX = mapX.get();
      const currentMapY = mapY.get();
      const deltaMapX = (shipPosRef.current.x - proposedX) * 12;
      const deltaMapY = (shipPosRef.current.y - proposedY) * 12;
      const proposedMapX = currentMapX + deltaMapX;
      const proposedMapY = currentMapY + deltaMapY;

      const collision = checkBarrierCollision(proposedMapX, proposedMapY);
      if (collision.isColliding) {
        // Ativa flash vermelho
        setIsColliding(true);
        setTimeout(() => setIsColliding(false), 200); // Flash de 0.2 segundos
        if (collision.collisionPoint) {
          repelPlayer(collision.collisionPoint.x, collision.collisionPoint.y);
        }
        // Reproduz som de colisão
        playBarrierCollisionSound();
        // Mostra notificação
        showCollisionNotification();
        newX = shipPosRef.current.x;
        newY = shipPosRef.current.y;
        allowMovement = false;
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
      }

      setShipPosition({ x: newX, y: newY });

      // Só atualiza mapa visual se movimento é permitido
      if (allowMovement) {
        // Atualiza mapa visual com wrap
        let newMapX = mapX.get() + deltaX;
        let newMapY = mapY.get() + deltaY;

        // Wrap visual do mapa quando sair muito longe
        const wrapThreshold = 5000; // pixels antes de fazer wrap
        if (newMapX > wrapThreshold) newMapX -= wrapThreshold * 2;
        if (newMapX < -wrapThreshold) newMapX += wrapThreshold * 2;
        if (newMapY > wrapThreshold) newMapY -= wrapThreshold * 2;
        if (newMapY < -wrapThreshold) newMapY += wrapThreshold * 2;

        mapX.set(newMapX);
        mapY.set(newMapY);
      }

      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 1) {
        setHasMoved(true);
        const newAngle = Math.atan2(-deltaY, -deltaX) * (180 / Math.PI) + 90;
        targetRotation.current = newAngle;
        lastRotationUpdate.current = Date.now();
      }

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      lastMoveTime.current = currentTime;
    };

    const handleGlobalMouseUp = async () => {
      // Handle point resizing end
      if (isAdmin && resizingPoint !== null) {
        await savePoints(points);
        setResizingPoint(null);
        setResizeStartScale(1);
        setResizeStartY(0);
        return;
      }

      // Handle point rotation end
      if (isAdmin && rotatingPoint !== null) {
        await savePoints(points);
        setRotatingPoint(null);
        setRotateStartRotation(0);
        setRotateStartAngle(0);
        return;
      }

      // Handle point dragging end
      if (isAdmin && draggingPoint !== null) {
        await savePoints(points);
        setDraggingPoint(null);
        setDragOffset({ x: 0, y: 0 });
        return;
      }

      setIsDragging(false);
      setIsHolding(false);
      setHoldProgress(0);
      setHoldStartTime(null);

      // Se não moveu (apenas clique), para completamente
      if (!hasMoved) {
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
      }

      localStorage.setItem(
        "xenopets-player-data",
        JSON.stringify({
          ship: shipPosRef.current,
          map: { x: mapX.get(), y: mapY.get() },
        }),
      );
    };

    // Touch event handlers globais
    const handleGlobalTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      // Handle point resizing first
      if (isAdmin && resizingPoint !== null) {
        const deltaY = touch.clientY - resizeStartY;
        const scaleFactor = 1 + deltaY * 0.002;
        const newScale = Math.max(
          0.5,
          Math.min(3, resizeStartScale * scaleFactor),
        );

        const newPoints = points.map((p) =>
          p.id === resizingPoint ? { ...p, scale: newScale } : p,
        );
        setPoints(newPoints);
        return;
      }

      // Handle point rotation
      if (isAdmin && rotatingPoint !== null) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const point = points.find((p) => p.id === rotatingPoint);
        if (!point) return;

        const centerX = (point.x / 100) * rect.width;
        const centerY = (point.y / 100) * rect.height;
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        const currentAngle =
          Math.atan2(touchY - centerY, touchX - centerX) * (180 / Math.PI);
        const angleDelta = currentAngle - rotateStartAngle;
        let newRotation = (rotateStartRotation + angleDelta) % 360;

        // Normalize to 0-360 range
        if (newRotation < 0) newRotation += 360;

        const newPoints = points.map((p) =>
          p.id === rotatingPoint ? { ...p, rotation: newRotation } : p,
        );

        setPoints(newPoints);
        return;
      }

      // Handle point dragging
      if (isAdmin && draggingPoint !== null) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const touchX = touch.clientX - rect.left - dragOffset.x;
        const touchY = touch.clientY - rect.top - dragOffset.y;

        // Simple percentage system - no barriers
        const newX = (touchX / rect.width) * 100;
        const newY = (touchY / rect.height) * 100;

        const newPoints = points.map((p) =>
          p.id === draggingPoint ? { ...p, x: newX, y: newY } : p,
        );
        setPoints(newPoints);
        return;
      }

      // Para o timer de auto-piloto se o touch se mover
      if (isHolding) {
        setIsHolding(false);
        setHoldProgress(0);
        setHoldStartTime(null);
      }

      const currentTime = Date.now();
      const deltaTime = currentTime - lastMoveTime.current;
      const deltaX = touch.clientX - lastMousePos.current.x;
      const deltaY = touch.clientY - lastMousePos.current.y;

      if (deltaTime > 0) {
        const velX = Math.max(-1.5, Math.min(1.5, deltaX * 0.08));
        const velY = Math.max(-1.5, Math.min(1.5, deltaY * 0.08));
        setVelocity({ x: velX, y: velY });
      }

      const proposedX = wrap(
        shipPosRef.current.x - deltaX / 12,
        0,
        WORLD_CONFIG.width,
      );
      const proposedY = wrap(
        shipPosRef.current.y - deltaY / 12,
        0,
        WORLD_CONFIG.height,
      );

      const collision = checkBarrierCollision(proposedX, proposedY, points);
      let allowMovement = !collision.isColliding;
      let newX = proposedX;
      let newY = proposedY;

      if (collision.isColliding) {
        repelPlayer(collision);
        playBarrierCollisionSound();
        showCollisionNotification();
        newX = shipPosRef.current.x;
        newY = shipPosRef.current.y;
        allowMovement = false;
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
      }

      setShipPosition({ x: newX, y: newY });

      // Só atualiza mapa visual se movimento é permitido
      if (allowMovement) {
        let newMapX = mapX.get() + deltaX;
        let newMapY = mapY.get() + deltaY;

        const wrapThreshold = 5000;
        if (newMapX > wrapThreshold) newMapX -= wrapThreshold * 2;
        if (newMapX < -wrapThreshold) newMapX += wrapThreshold * 2;
        if (newMapY > wrapThreshold) newMapY -= wrapThreshold * 2;
        if (newMapY < -wrapThreshold) newMapY += wrapThreshold * 2;

        mapX.set(newMapX);
        mapY.set(newMapY);
      }

      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 1) {
        setHasMoved(true);
        const newAngle = Math.atan2(-deltaY, -deltaX) * (180 / Math.PI) + 90;
        targetRotation.current = newAngle;
        lastRotationUpdate.current = Date.now();
      }

      lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      lastMoveTime.current = currentTime;

      e.preventDefault();
    };

    const handleGlobalTouchEnd = async () => {
      // Handle point resizing end
      if (isAdmin && resizingPoint !== null) {
        await savePoints(points);
        setResizingPoint(null);
        setResizeStartScale(1);
        setResizeStartY(0);
        return;
      }

      // Handle point rotation end
      if (isAdmin && rotatingPoint !== null) {
        await savePoints(points);
        setRotatingPoint(null);
        setRotateStartRotation(0);
        setRotateStartAngle(0);
        return;
      }

      // Handle point dragging end
      if (isAdmin && draggingPoint !== null) {
        await savePoints(points);
        setDraggingPoint(null);
        setDragOffset({ x: 0, y: 0 });
        return;
      }

      setIsDragging(false);
      setIsHolding(false);
      setHoldProgress(0);
      setHoldStartTime(null);

      // Se não moveu (apenas toque), para completamente
      if (!hasMoved) {
        setVelocity({ x: 0, y: 0 });
        setIsDecelerating(false);
      }

      localStorage.setItem(
        "xenopets-player-data",
        JSON.stringify({
          ship: shipPosRef.current,
          map: { x: mapX.get(), y: mapY.get() },
        }),
      );
    };

    if (isDragging || draggingPoint !== null || rotatingPoint !== null) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
      document.addEventListener("touchmove", handleGlobalTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("touchmove", handleGlobalTouchMove);
      document.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, [
    isDragging,
    isHolding,
    mapX,
    mapY,
    shipRotation,
    checkBarrierCollision,
    repelPlayer,
    showCollisionNotification,
    draggingPoint,
    dragOffset,
    rotatingPoint,
    rotateStartRotation,
    rotateStartAngle,
    points,
    isAdmin,
  ]);

  // Save points to database and localStorage as backup
  const savePoints = async (newPoints: Point[]) => {
    try {
      // Update each world in the database if it has a string ID (from database)
      const updatePromises = newPoints
        .filter((point) => typeof point.id === "string")
        .map((point) =>
          gameService.updateGalaxyWorldPosition(
            point.id as string,
            point.x,
            point.y,
            point.scale || 1,
          ),
        );

      await Promise.all(updatePromises);
      console.log("✅ Posições salvas no banco de dados");
    } catch (error) {
      console.error("❌ Erro ao salvar no banco:", error);
    }

    // Always save to localStorage as backup
    localStorage.setItem("xenopets-galaxy-points", JSON.stringify(newPoints));
    setPoints(newPoints);
  };

  // Sistema de navegação inteligente com curvas suaves
  useEffect(() => {
    const updateWanderingShip = () => {
      setWanderingShip((prev) => {
        // Calcula distância do jogador (centro do mapa) para a nave
        const centerX = 50;
        const centerY = 50;
        const dx = prev.x - centerX;
        const dy = prev.y - centerY;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        // Debug da posi��ão (apenas ocasionalmente para não spam)
        if (Math.random() < 0.01) {
          console.log(
            `📍 Nave em: (${prev.x.toFixed(1)}, ${prev.y.toFixed(1)}), Jogador: (${centerX}, ${centerY}), Distância: ${distanceToPlayer.toFixed(2)}`,
          );
        }

        // Calcula distância para o mundo mais próximo
        let nearestWorldDistance = 100;
        if (points && points.length > 0) {
          nearestWorldDistance = Math.min(
            ...points.map((point) => {
              const worldDx = prev.x - point.x;
              const worldDy = prev.y - point.y;
              return Math.sqrt(worldDx * worldDx + worldDy * worldDy);
            }),
          );
        }

        // Sistema de pausas perto dos mundos
        let isPaused = prev.isPaused;
        let pauseTimer = prev.pauseTimer;
        let hasRecentlyPaused = prev.hasRecentlyPaused;
        let pauseCooldown = Math.max(0, prev.pauseCooldown - 1);

        // Se está pausado, diminui o timer
        if (isPaused) {
          pauseTimer--;
          if (pauseTimer <= 0) {
            isPaused = false;
            hasRecentlyPaused = true;
            pauseCooldown = 600; // 10 segundos de cooldown
          }
        } else if (
          nearestWorldDistance < 8 &&
          !hasRecentlyPaused &&
          pauseCooldown <= 0
        ) {
          // Pausa perto de um mundo
          isPaused = true;
          pauseTimer = 180 + Math.random() * 240; // 3-7 segundos de pausa
        }

        // Se está pausado, não move
        if (isPaused) {
          return {
            ...prev,
            isPaused,
            pauseTimer,
            hasRecentlyPaused,
            pauseCooldown,
            distanceToPlayer,
            nearestWorldDistance,
            isMoving: false,
          };
        }

        // Reset flag se está longe dos mundos
        if (nearestWorldDistance > 15) {
          hasRecentlyPaused = false;
        }

        // Sistema de comportamento inteligente
        let behavior = prev.behavior;
        let behaviorTimer = prev.behaviorTimer + 1;
        let nextBehaviorChange = prev.nextBehaviorChange;
        let targetPlanet = prev.targetPlanet;
        let orbitAngle = prev.orbitAngle;
        let newDirection = prev.direction;
        let newTargetDirection = prev.targetDirection;
        let currentSpeed = prev.baseSpeed;

        // Verifica se deve mudar comportamento
        if (behaviorTimer >= nextBehaviorChange) {
          if (behavior === "free" && points && points.length > 0) {
            // Escolhe um planeta aleatório para orbitar
            targetPlanet = points[Math.floor(Math.random() * points.length)];
            behavior = "approaching";
            behaviorTimer = 0;
            nextBehaviorChange = 9999; // Não muda até completar a sequ��ncia
          } else if (behavior === "orbiting") {
            behavior = "leaving";
            behaviorTimer = 0;
            nextBehaviorChange = 300 + Math.random() * 300; // 5-10 segundos saindo
          } else if (behavior === "leaving") {
            behavior = "free";
            targetPlanet = null;
            behaviorTimer = 0;
            nextBehaviorChange = 1200 + Math.random() * 1800; // 20-50 segundos livre
          }
        }

        let newVelocityX = 0;
        let newVelocityY = 0;

        if (behavior === "approaching" && targetPlanet) {
          // Movimento direcionado para o planeta
          const dx = targetPlanet.x - prev.x;
          const dy = targetPlanet.y - prev.y;
          const distanceToPlanet = Math.sqrt(dx * dx + dy * dy);

          if (distanceToPlanet <= prev.approachDistance) {
            behavior = "orbiting";
            behaviorTimer = 0;
            nextBehaviorChange = 1800 + Math.random() * 1200; // 30-50 segundos orbitando
            orbitAngle = Math.atan2(dy, dx);
          } else {
            newDirection = Math.atan2(dy, dx);
            currentSpeed = prev.baseSpeed * 1.5; // Mais rápido ao se aproximar
            newVelocityX = Math.cos(newDirection) * currentSpeed;
            newVelocityY = Math.sin(newDirection) * currentSpeed;
          }
        } else if (behavior === "orbiting" && targetPlanet) {
          // Movimento orbital ao redor do planeta
          orbitAngle += prev.orbitSpeed;
          const orbitX =
            targetPlanet.x + Math.cos(orbitAngle) * prev.orbitRadius;
          const orbitY =
            targetPlanet.y + Math.sin(orbitAngle) * prev.orbitRadius;

          // Move suavemente para a posição orbital
          const dx = orbitX - prev.x;
          const dy = orbitY - prev.y;
          newVelocityX = dx * 0.1;
          newVelocityY = dy * 0.1;

          // Direção tangencial à órbita
          newDirection = orbitAngle + Math.PI / 2;
        } else if (behavior === "leaving" && targetPlanet) {
          // Movimento se afastando do planeta
          const dx = prev.x - targetPlanet.x;
          const dy = prev.y - targetPlanet.y;
          newDirection = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.0;
          currentSpeed = prev.baseSpeed * 1.2;
          newVelocityX = Math.cos(newDirection) * currentSpeed;
          newVelocityY = Math.sin(newDirection) * currentSpeed;
        } else {
          // Comportamento livre - movimento aleatório suave
          let newDirectionChangeTimer = prev.directionChangeTimer + 1;
          let newNextDirectionChange = prev.nextDirectionChange;

          if (newDirectionChangeTimer >= newNextDirectionChange) {
            newTargetDirection = Math.random() * Math.PI * 2;
            newDirectionChangeTimer = 0;
            newNextDirectionChange = 300 + Math.random() * 600;
          }

          // Interpola suavemente para a nova direção
          let directionDiff = newTargetDirection - newDirection;
          if (directionDiff > Math.PI) directionDiff -= Math.PI * 2;
          if (directionDiff < -Math.PI) directionDiff += Math.PI * 2;
          newDirection += directionDiff * 0.01;

          // Velocidade variável
          const time = Date.now() * 0.001;
          const speedMultiplier =
            0.7 + 0.6 * Math.sin(time * 0.5) * Math.sin(time * 0.3);
          currentSpeed = prev.baseSpeed * speedMultiplier;

          newVelocityX = Math.cos(newDirection) * currentSpeed;
          newVelocityY = Math.sin(newDirection) * currentSpeed;
        }

        // Aplica movimento suave com interpolação
        const newX = prev.x + newVelocityX;
        const newY = prev.y + newVelocityY;

        // Mantém nave dentro da barreira tracejada (35% do centro)
        const barrierLimit = 32; // Ligeiramente menor que 35% para ficar bem dentro da barreira
        const distanceFromCenter = Math.sqrt(
          (newX - 50) * (newX - 50) + (newY - 50) * (newY - 50),
        );

        let finalX = newX;
        let finalY = newY;
        let bounceDirection = newDirection;

        // Se chegar perto da barreira, muda direção suavemente
        if (distanceFromCenter > barrierLimit) {
          // Calcula direção de volta para o centro com variação aleatória
          const angleToCenter = Math.atan2(50 - newY, 50 - newX);
          bounceDirection = angleToCenter + (Math.random() - 0.5) * 1.0;

          // Mantém na posi��ão atual para evitar teleporte
          finalX = prev.x;
          finalY = prev.y;
        }

        // Calcula rotação baseada na direção do movimento
        const newRotation = (newDirection * 180) / Math.PI + 90;

        return {
          ...prev,
          x: finalX,
          y: finalY,
          velocityX: newVelocityX,
          velocityY: newVelocityY,
          direction:
            distanceFromCenter > barrierLimit ? bounceDirection : newDirection,
          targetDirection: newTargetDirection,
          directionChangeTimer: prev.directionChangeTimer + 1,
          nextDirectionChange: prev.nextDirectionChange,
          rotation: newRotation,
          isMoving: true,
          isPaused: false,
          pauseTimer: 0,
          hasRecentlyPaused,
          pauseCooldown,
          distanceToPlayer,
          nearestWorldDistance,
          behavior,
          behaviorTimer,
          nextBehaviorChange,
          targetPlanet,
          orbitAngle,
        };
      });
    };

    // Inicializa movimento suave da nave
    setWanderingShip((prev) => ({
      ...prev,
      isMoving: true,
      direction: Math.random() * Math.PI * 2,
      targetDirection: Math.random() * Math.PI * 2,
    }));

    // Usa setInterval para movimento mais consistente (60 FPS)
    const intervalId = setInterval(updateWanderingShip, 16);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Sistema de som para nave mercante baseado na proximidade
  const [merchantEngineSound, setMerchantEngineSound] = useState<{
    stop: () => void;
    setVolume: (vol: number) => void;
  } | null>(null);

  useEffect(() => {
    const distance = wanderingShip.distanceToPlayer;
    const maxDistance = 15; // Distância reduzida para só tocar quando realmente perto
    const shouldPlaySound = distance < maxDistance; // Som só quando bem perto

    console.log(
      `🔊 Som da nave: distância=${distance.toFixed(2)}, deveria tocar=${shouldPlaySound}`,
    );

    if (shouldPlaySound) {
      // Calcula volume baseado na distância com curva mais suave
      const normalizedDistance = Math.max(
        0,
        Math.min(1, distance / maxDistance),
      );
      const volume = (1 - normalizedDistance) * 0.5; // Volume m��ximo aumentado para 0.5

      if (!merchantEngineSound) {
        // Cria um som de motor diferente para a nave mercante
        try {
          const audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
          const startTime = audioContext.currentTime;

          const osc1 = audioContext.createOscillator();
          const osc2 = audioContext.createOscillator();
          const gain1 = audioContext.createGain();
          const gain2 = audioContext.createGain();
          const masterGain = audioContext.createGain();

          osc1.connect(gain1);
          osc2.connect(gain2);
          gain1.connect(masterGain);
          gain2.connect(masterGain);
          masterGain.connect(audioContext.destination);

          // Som diferenciado para nave mercante - mais grave
          osc1.type = "triangle";
          osc2.type = "sine";

          osc1.frequency.setValueAtTime(70, startTime); // Mais grave
          osc2.frequency.setValueAtTime(140, startTime); // Harmônico

          // Volumes iniciais baseados na distância
          gain1.gain.setValueAtTime(volume * 0.6, startTime);
          gain2.gain.setValueAtTime(volume * 0.4, startTime);

          // Fade-in suave
          masterGain.gain.setValueAtTime(0, startTime);
          masterGain.gain.linearRampToValueAtTime(1, startTime + 0.3);

          osc1.start(startTime);
          osc2.start(startTime);

          const soundControl = {
            stop: () => {
              try {
                const stopTime = audioContext.currentTime;
                masterGain.gain.linearRampToValueAtTime(0, stopTime + 0.3);
                setTimeout(() => {
                  try {
                    osc1.stop();
                    osc2.stop();
                    audioContext.close();
                  } catch (e) {
                    // Ignora erros de stop
                  }
                }, 350);
              } catch (e) {
                console.warn("Error stopping merchant sound:", e);
              }
            },
            setVolume: (vol: number) => {
              try {
                const currentTime = audioContext.currentTime;
                gain1.gain.linearRampToValueAtTime(
                  vol * 0.6,
                  currentTime + 0.1,
                );
                gain2.gain.linearRampToValueAtTime(
                  vol * 0.4,
                  currentTime + 0.1,
                );
              } catch (e) {
                console.warn("Error setting volume:", e);
              }
            },
          };

          setMerchantEngineSound(soundControl);
          console.log(`🎵 Som da nave criado com volume: ${volume.toFixed(3)}`);
        } catch (e) {
          console.warn("Merchant engine sound creation failed:", e);
        }
      } else {
        // Atualiza volume do som existente com suavidade
        merchantEngineSound.setVolume(volume);
        console.log(`🔊 Volume atualizado: ${volume.toFixed(3)}`);
      }
    } else {
      // Para o som se existir
      if (merchantEngineSound) {
        console.log("🔇 Parando som da nave");
        merchantEngineSound.stop();
        setMerchantEngineSound(null);
      }
    }
  }, [wanderingShip.distanceToPlayer, merchantEngineSound]);

  // Cleanup do som da nave mercante quando componente desmonta
  useEffect(() => {
    return () => {
      if (merchantEngineSound) {
        merchantEngineSound.stop();
      }
    };
  }, []);

  // State for confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    point: Point | null;
  }>({ show: false, point: null });

  // Utility function to calculate distance from mouse to point center
  const getDistanceToPoint = (
    e: React.MouseEvent,
    point: Point,
  ): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const pointX = (point.x / 100) * rect.width;
    const pointY = (point.y / 100) * rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    return Math.sqrt(
      Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2),
    );
  };

  const handlePointInteraction = (e: React.MouseEvent, point: Point) => {
    e.stopPropagation();
    console.log("🖱️ Point clicked:", point.label, "isAdmin:", isAdmin);

    // For debug: always show modal regardless of distance
    console.log("✅ Showing confirmation modal (debug mode)");
    setConfirmModal({ show: true, point });
  };

  const handleConfirm = () => {
    if (confirmModal.point) {
      // Set selected world data
      setSelectedWorld({
        id: confirmModal.point.id.toString(),
        name: confirmModal.point.label,
        description: `Explore o fascinante mundo de ${confirmModal.point.label}`,
        type: confirmModal.point.type,
        image: confirmModal.point.image,
      });

      // Navigate to world detail screen
      setCurrentScreen("worldDetail");
      setConfirmModal({ show: false, point: null });
    }
  };

  const handleCancel = () => {
    setConfirmModal({ show: false, point: null });
  };

  // Point drag handlers
  const handlePointMouseDown = (e: React.MouseEvent, point: Point) => {
    if (!isAdmin) return;

    e.preventDefault();
    e.stopPropagation();

    // Check if holding Ctrl for resize mode
    if (e.ctrlKey) {
      setResizingPoint(point.id);
      setResizeStartScale(point.scale || 1);
      setResizeStartY(e.clientY);
      return;
    }

    // Check if holding Alt for rotation mode
    if (e.altKey) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = (point.x / 100) * rect.width;
      const centerY = (point.y / 100) * rect.height;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const startAngle =
        Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);

      setRotatingPoint(point.id);
      setRotateStartRotation(point.rotation || 0);
      setRotateStartAngle(startAngle);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const pointX = (point.x / 100) * rect.width;
    const pointY = (point.y / 100) * rect.height;

    setDraggingPoint(point.id);
    setDragOffset({
      x: mouseX - pointX,
      y: mouseY - pointY,
    });
  };

  const handlePointTouchStart = (e: React.TouchEvent, point: Point) => {
    if (!isAdmin) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    if (!touch) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    const pointX = (point.x / 100) * rect.width;
    const pointY = (point.y / 100) * rect.height;

    setDraggingPoint(point.id);
    setDragOffset({
      x: touchX - pointX,
      y: touchY - pointY,
    });
  };

  const handlePointMouseMove = (e: React.MouseEvent) => {
    if (!isAdmin || draggingPoint === null) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left - dragOffset.x;
    const mouseY = e.clientY - rect.top - dragOffset.y;

    // Simple percentage system - no barriers
    const newX = (mouseX / rect.width) * 100;
    const newY = (mouseY / rect.height) * 100;

    const newPoints = points.map((p) =>
      p.id === draggingPoint ? { ...p, x: newX, y: newY } : p,
    );

    setPoints(newPoints);
  };

  const handlePointMouseUp = async () => {
    if (!isAdmin || draggingPoint === null) return;

    // Save final position
    await savePoints(points);
    setDraggingPoint(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const resetShipPosition = () => {
    setShipPosition({ x: 50, y: 50 });
    setVelocity({ x: 0, y: 0 });
    setIsDecelerating(false);
    setIsAutoPilot(false);
    animate(mapX, 0, { duration: 0.5 });
    animate(mapY, 0, { duration: 0.5 });
    animate(shipRotation, 0, { duration: 0.5 });
    localStorage.removeItem("xenopets-player-data");
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[650px] bg-gradient-to-br from-gray-950 via-slate-900 to-black rounded-2xl overflow-hidden ${
        draggingPoint !== null
          ? "cursor-grabbing"
          : isDragging
            ? "cursor-grabbing"
            : isAutoPilot
              ? "cursor-pointer"
              : "cursor-grab"
      }`}
      style={{ userSelect: "none" }}
      onMouseMove={(e) => {
        handleMouseMove(e);
        handlePointMouseMove(e);
      }}
      onMouseUp={() => {
        handleMouseUp();
        handlePointMouseUp();
      }}
      onMouseLeave={() => {
        handleMouseUp();
        handlePointMouseUp();
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Simple progress bar for auto-pilot activation */}
      {isHolding && holdProgress > 0 && (
        <motion.div
          className="absolute z-50 w-full flex justify-center"
          style={{ top: "calc(50% - 50px)" }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <div className="w-12 h-2 bg-gray-800/60 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${holdProgress * 100}%` }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* Notificaç��o de Colis��o - Centralizada no topo do mapa */}
      {collisionNotification.show && (
        <div className="absolute top-4 left-0 right-0 z-50 flex justify-center">
          <motion.div
            className="bg-black/10 text-white/60 px-4 py-2 rounded-lg"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs font-mono text-white/60 leading-tight text-center">
              ALTO: nave n��o credenciada
              <br />
              para cruzar barreira
            </p>
          </motion.div>
        </div>
      )}
      {/* Canvas para estrelas com parallax otimizado */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: "100%",
          height: "100%",
          willChange: "contents",
        }}
      />

      {/* Nebulosas de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{
            background: "radial-gradient(circle, #374151, #1f2937)",
            left: "20%",
            top: "30%",
          }}
        />
        <div
          className="absolute w-48 h-48 rounded-full opacity-8 blur-2xl"
          style={{
            background: "radial-gradient(circle, #1f2937, #111827)",
            right: "25%",
            bottom: "20%",
          }}
        />
      </div>

      {/* Área de drag fixa - sempre cobre toda a tela */}
      <div
        className={`absolute inset-0 z-5 ${
          draggingPoint !== null
            ? "pointer-events-none"
            : isDragging
              ? "cursor-grabbing"
              : isAutoPilot
                ? "cursor-pointer"
                : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e);
          handlePointMouseMove(e);
        }}
        onMouseUp={() => {
          handleMouseUp();
          handlePointMouseUp();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ backgroundColor: "transparent", userSelect: "none" }}
      />

      {/* Mapa visual - movido pelo drag acima */}
      <motion.div
        ref={mapRef}
        className="absolute inset-0 w-[300%] h-[300%] -left-full -top-full pointer-events-none"
        style={{
          x: mapX,
          y: mapY,
          willChange: "transform", // otimização para GPU
        }}
      >
        {/* Barreira circular fixa no centro do mapa */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%", // Centro do mundo (100% = WORLD_CONFIG.width)
            top: "50%", // Centro do mundo (100% = WORLD_CONFIG.height)
            width: "2400px", // Diâmetro 2400px = 1200px de raio
            height: "2400px",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            zIndex: 5,
          }}
        >
          {/* Animação de rotaç����o continua */}
          <motion.div
            className="w-full h-full rounded-full border-2 border-dashed"
            style={{
              borderColor: isColliding
                ? "rgba(239, 68, 68, 0.9)"
                : "rgba(255, 255, 255, 0.15)",
            }}
            animate={{
              rotate: 360,
            }}
            transition={{
              rotate: {
                duration: 600, // Rotação muito mais lenta - 10 minutos por volta
                repeat: Infinity,
                ease: "linear",
              },
            }}
          />

          {/* Nave mercante navegante dentro da barreira */}
          <motion.div
            className="absolute cursor-pointer"
            style={{
              zIndex: 100,
              left: `${wanderingShip.x}%`,
              top: `${wanderingShip.y}%`,
              transform: `translate(-50%, -50%)`,
              pointerEvents: "auto",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowShipModal(true);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="relative w-10 h-10"
              style={{ rotate: wanderingShip.rotation }}
              animate={{
                scale: wanderingShip.isPaused ? 0.95 : 1.02,
                // Movimento diferente quando pausado
                y: wanderingShip.isPaused
                  ? [0, -0.5, 0, 0.5, 0]
                  : [0, -1, 0, 1, 0],
                x: wanderingShip.isPaused
                  ? [0, 0.2, 0, -0.2, 0]
                  : [0, 0.5, 0, -0.5, 0],
              }}
              transition={{
                scale: { duration: 0.5 },
                y: {
                  duration: wanderingShip.isPaused ? 1.5 : 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
                x: {
                  duration: wanderingShip.isPaused ? 1.2 : 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
            >
              {/* Imagem da nave mercante */}
              <motion.img
                src="https://cdn.builder.io/api/v1/image/assets%2Fc013caa4db474e638dc2961a6085b60a%2F35b6bdfaaf2f41f2882a22458f10917d?format=webp&width=800"
                alt="Nave Mercante"
                className="w-full h-full object-contain drop-shadow-lg"
              />

              {/* Trilha de propulsão - apenas quando em movimento */}
              {wanderingShip.isMoving && !wanderingShip.isPaused && (
                <>
                  <motion.div
                    className="absolute w-0.5 h-6 bg-gradient-to-t from-transparent to-orange-400 transform -translate-x-1/2"
                    style={{
                      top: "calc(100% - 12px)",
                      left: "calc(50% - 1px)",
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
                  <motion.div
                    className="absolute w-0.5 h-5 bg-gradient-to-t from-transparent to-yellow-300 transform -translate-x-1/2"
                    style={{
                      top: "calc(100% - 8px)",
                      left: "calc(50% - 1px)",
                      zIndex: -1,
                    }}
                    animate={{
                      opacity: [0.2, 0.6, 0.2],
                      scaleY: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 0.3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.1,
                    }}
                  />
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
        {/* Loading indicator for worlds */}
        {isLoadingWorlds && (
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
              <p className="text-gray-300 text-sm">Carregando mundos...</p>
            </div>
          </div>
        )}

        {/* Novos pontos clicáveis */}
        {!isLoadingWorlds &&
          points.map((point) => (
            <motion.div
              key={point.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                isAdmin
                  ? resizingPoint === point.id
                    ? "cursor-crosshair"
                    : rotatingPoint === point.id
                      ? "cursor-alias"
                      : "cursor-grab hover:cursor-grab active:cursor-grabbing"
                  : "cursor-pointer"
              } ${draggingPoint === point.id || resizingPoint === point.id || rotatingPoint === point.id ? "z-50" : "z-30"}`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                pointerEvents: "auto",
              }}
              onClick={(e) => handlePointInteraction(e, point)}
              {...(isAdmin && {
                onMouseDown: (e) => handlePointMouseDown(e, point),
              })}
              animate={{
                y: [0, -5 - point.id * 0.8, 0, 3.5 + point.id * 0.5, 0],
                x: [0, 2 + point.id * 0.4, 0, -2.5 - point.id * 0.3, 0],
                rotate: [0, 1 + point.id * 0.15, 0, -1.3 - point.id * 0.1, 0],
              }}
              transition={{
                y: {
                  duration: 6 + point.id * 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: point.id * 1,
                },
                x: {
                  duration: 7 + point.id * 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: point.id * 1.3,
                },
                rotate: {
                  duration: 9 + point.id * 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: point.id * 1.8,
                },
              }}
            >
              <div className="relative group">
                {/* Click zone indicator - 30px radius circle (always visible) */}
                {true && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                    <div
                      className="border-4 border-red-500 rounded-full opacity-100 bg-red-500/20"
                      style={{
                        width: "60px",
                        height: "60px",
                      }}
                    >
                      <div className="w-full h-full border-2 border-red-400 rounded-full animate-pulse bg-red-400/30"></div>
                    </div>
                  </div>
                )}

                {/* Imagem do planeta/estação */}
                <div
                  className={`w-48 h-48 transition-all duration-300 relative ${
                    draggingPoint === point.id
                      ? "scale-110 brightness-110"
                      : resizingPoint === point.id
                        ? "brightness-125"
                        : "hover:scale-105 hover:brightness-110"
                  }`}
                  style={{
                    transform: `scale(${point.scale || 1}) rotate(${point.rotation || 0}deg)`,
                    filter:
                      draggingPoint === point.id
                        ? "drop-shadow(0 0 20px rgba(255, 255, 0, 0.8)) drop-shadow(0 8px 25px rgba(0, 0, 0, 0.4))"
                        : resizingPoint === point.id
                          ? "drop-shadow(0 0 25px rgba(0, 255, 255, 0.8)) drop-shadow(0 8px 25px rgba(0, 0, 0, 0.4))"
                          : rotatingPoint === point.id
                            ? "drop-shadow(0 0 25px rgba(255, 0, 255, 0.8)) drop-shadow(0 8px 25px rgba(0, 0, 0, 0.4))"
                            : "drop-shadow(0 8px 25px rgba(0, 0, 0, 0.4)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.1))",
                  }}
                >
                  <img
                    src={point.image}
                    alt={point.label}
                    className="w-full h-full object-contain"
                    crossOrigin="anonymous"
                    loading="eager"
                    onLoad={(e) => {
                      console.log(`✅ Imagem carregada: ${point.label}`);
                    }}
                    onError={(e) => {
                      console.error(
                        `�� Erro ao carregar imagem: ${point.label}`,
                        point.image,
                      );
                    }}
                  />

                  {/* Brilho de seleção para admin */}
                  {draggingPoint === point.id && (
                    <div className="absolute inset-0 rounded-lg bg-yellow-400/30 animate-pulse"></div>
                  )}
                </div>

                {/* Admin indicator */}
                {isAdmin && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white opacity-80 shadow-lg">
                    <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
      </motion.div>

      {/* Nave do jogador - fixa no centro */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <PlayerShip
          rotation={shipRotation}
          isNearPoint={false}
          isDragging={isDragging || isAutoPilot}
          isDecelerating={isDecelerating}
        />
      </div>

      {/* Canvas para estrelas parallax acima do jogador */}
      <canvas
        ref={parallaxCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 25 }}
      />

      {/* Modal da Nave Navegante */}
      <AnimatePresence>
        {showShipModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShipModal(false)}
            />
            <motion.div
              className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 z-50"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white rounded-3xl max-w-md sm:max-w-lg w-full shadow-2xl border border-gray-200 relative max-h-[95vh] overflow-y-auto">
                {/* Botão de fechar */}
                <button
                  onClick={() => setShowShipModal(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10 bg-white/80 backdrop-blur-sm"
                >
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Header sem gradiente */}
                <div className="bg-white rounded-t-3xl p-6 text-center border-b border-gray-100">
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2Fcd7f7270636644acbedf48e0ef62abd0%2F9b01dc80171f480d8fb5a342061dde24?format=webp&width=800"
                    alt="Nave Mercante"
                    className="w-32 h-32 sm:w-48 sm:h-48 mx-auto mb-4"
                  />
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                    Capitão Zyx
                  </h2>
                  <p className="text-sm sm:text-base text-blue-600 font-medium">
                    Nave Mercante "Estrela Errante"
                  </p>
                </div>

                {/* Conteúdo principal */}
                <div className="p-6">
                  {/* Texto de diálogo */}
                  <div className="mb-6">
                    <div className="bg-blue-50 rounded-2xl p-4 sm:p-6 border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 min-h-[3rem]">
                            {typewriterText1}
                          </p>
                          {showTypewriter2 && (
                            <p className="text-sm text-gray-600 min-h-[2rem]">
                              {typewriterText2}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Área de ações futuras */}
                  <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        Área de Interação
                      </p>
                      <p className="text-xs text-gray-500">
                        Comércio • Missões • Informações
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Notificação do modo de redimensionamento ativo */}
      {resizingPoint !== null && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <motion.div
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg border border-blue-400"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                🔧 Modo Redimensionar Ativo
              </span>
            </div>
            <div className="text-xs text-blue-100 mt-1">
              Pressione Esc para sair
            </div>
          </motion.div>
        </div>
      )}

      {/* Notificação do modo de rotação ativo */}
      {rotatingPoint !== null && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <motion.div
            className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg border border-purple-400"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">🔄 Modo Rotação Ativo</span>
            </div>
            <div className="text-xs text-purple-100 mt-1">
              Pressione Esc para sair
            </div>
          </motion.div>
        </div>
      )}

      {/* Coordenadas simplificadas na parte inferior */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/20 text-xs font-mono font-thin whitespace-nowrap">
        X: {mapX.get().toFixed(1)} Y: {mapY.get().toFixed(1)}
        {isAutoPilot && <span className="ml-4 text-blue-300">[AUTO]</span>}
      </div>

      {/* Landing Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && confirmModal.point && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full mb-4 overflow-hidden">
                  <img
                    src={confirmModal.point.image}
                    alt={confirmModal.point.label}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Pousar no Planeta
                </h3>

                <p className="text-gray-600 mb-6">
                  Deseja pousar em <strong>{confirmModal.point.label}</strong>?
                </p>

                <div className="flex space-x-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Sim, Pousar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
