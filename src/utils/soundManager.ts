/**
 * SoundManager - Gerenciador de sons do jogo
 *
 * Este utilitário cuida de carregar, reproduzir e gerenciar efeitos sonoros e música
 * de fundo para o jogo, garantindo uma experiência de áudio consistente.
 */

// Mapa para armazenar os áudios pré-carregados
const audioCache: Record<string, HTMLAudioElement> = {};

// Check browser support for audio formats
const getNotificationSoundPath = (): string => {
  const audio = new Audio();

  // Check MP3 support
  if (audio.canPlayType("audio/mpeg")) {
    return "/sounds/notification-pop.mp3";
  }

  // If MP3 not supported, we'll handle it in the playSound function
  return "/sounds/notification-pop.mp3";
};

// Lista de sons disponíveis no jogo
export const Sounds = {
  NOTIFICATION: getNotificationSoundPath(),
  // Adicionar mais sons aqui conforme necessário
};

/**
 * Pré-carrega um som específico
 * @param soundPath Caminho para o arquivo de som
 * @returns Promise que resolve quando o som estiver carregado
 */
export const preloadSound = (soundPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (audioCache[soundPath]) {
        resolve(); // Já está carregado
        return;
      }

      const audio = new Audio();
      audio.src = soundPath;

      audio.addEventListener(
        "canplaythrough",
        () => {
          audioCache[soundPath] = audio;
          console.log(`Som carregado: ${soundPath}`);
          resolve();
        },
        { once: true },
      );

      audio.addEventListener("error", (e) => {
        const target = e.target as HTMLAudioElement;
        const errorDetails = {
          path: soundPath,
          error: e.type,
          message: "Audio load failed",
          readyState: target?.readyState,
          networkState: target?.networkState,
          errorCode: (target?.error as any)?.code,
          errorMessage: (target?.error as any)?.message,
          canPlayType: audio.canPlayType("audio/mpeg"),
          src: audio.src,
        };
        console.warn(
          `Som não pode ser carregado (não crítico): ${soundPath}`,
          errorDetails,
        );
        // Don't reject for non-critical sound loading failures
        resolve();
      });

      audio.load();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `Erro ao configurar pré-carregamento para ${soundPath}:`,
        errorMsg,
      );
      reject(new Error(`Sound setup failed: ${errorMsg}`));
    }
  });
};

/**
 * Pré-carrega todos os sons definidos no objeto Sounds
 */
export const preloadAllSounds = async (): Promise<void> => {
  console.log("Iniciando pré-carregamento de todos os sons...");

  try {
    const loadPromises = Object.values(Sounds).map((soundPath) =>
      preloadSound(soundPath).catch((error) => {
        console.warn(`Failed to preload ${soundPath}:`, error.message);
        return null; // Continue with other sounds even if one fails
      }),
    );
    await Promise.all(loadPromises);
    console.log("Pré-carregamento de sons concluído");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao pré-carregar sons:", errorMsg);
  }
};

/**
 * Reproduz um som específico
 * @param soundPath Caminho para o arquivo de som
 * @param volume Volume (0 a 1), padrão 0.5
 * @returns Promise que resolve quando o som começar a tocar ou rejeita em caso de erro
 */
export const playSound = (
  soundPath: string,
  volume: number = 0.5,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Tenta usar o som em cache primeiro
      if (audioCache[soundPath]) {
        // Cria um clone para permitir reproduções simultâneas
        const soundClone = audioCache[soundPath].cloneNode(
          true,
        ) as HTMLAudioElement;
        soundClone.volume = volume;

        const playPromise = soundClone.play();
        if (playPromise) {
          playPromise
            .then(() => resolve())
            .catch((error) => {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              console.error(
                `Erro ao reproduzir som do cache (${soundPath}):`,
                errorMsg,
              );
              tryAlternativePlay(soundPath, volume, resolve, reject);
            });
        } else {
          resolve();
        }
        return;
      }

      // Se não estiver em cache, tente reproduzir diretamente
      tryAlternativePlay(soundPath, volume, resolve, reject);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Erro ao reproduzir som ${soundPath}:`, errorMsg);
      reject(new Error(`Sound play failed: ${errorMsg}`));
    }
  });
};

/**
 * Tenta reproduzir um som usando método alternativo
 */
const tryAlternativePlay = (
  soundPath: string,
  volume: number,
  resolve: () => void,
  reject: (error: any) => void,
): void => {
  try {
    const audio = new Audio(soundPath);
    audio.volume = volume;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => resolve())
        .catch((error) => {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(`Erro ao reproduzir som ${soundPath}:`, errorMsg);
          reject(new Error(`Alternative sound play failed: ${errorMsg}`));
        });
    } else {
      resolve();
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Erro na reprodução alternativa ${soundPath}:`, errorMsg);
    reject(new Error(`Alternative sound setup failed: ${errorMsg}`));
  }
};

// Controle de frequência para sons de colisão
let lastCollisionSoundTime = 0;
const COLLISION_SOUND_COOLDOWN = 300; // 300ms entre sons de colisão

/**
 * Creates a clean, crisp collision sound using Web Audio API
 */
const playCollisionSound = (): Promise<void> => {
  return new Promise((resolve) => {
    const now = Date.now();

    // Controla frequência - só toca se passou tempo suficiente
    if (now - lastCollisionSoundTime < COLLISION_SOUND_COOLDOWN) {
      resolve();
      return;
    }

    lastCollisionSoundTime = now;

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create a simple but effective collision sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      // Connect the audio nodes
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure the filter for a cleaner sound
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, audioContext.currentTime);
      filter.Q.setValueAtTime(1, audioContext.currentTime);

      // Create a sharp, clean collision sound
      oscillator.type = "triangle"; // Smoother than sawtooth
      oscillator.frequency.setValueAtTime(180, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        100,
        audioContext.currentTime + 0.12,
      );

      // Clean volume envelope - reduzido para evitar sobreposição
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.15,
        audioContext.currentTime + 0.01,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.12);

      setTimeout(() => resolve(), 150);
    } catch (error) {
      console.warn("Web Audio API collision sound failed:", error);
      resolve();
    }
  });
};

/**
 * Creates a notification sound using Web Audio API
 */
const playNotificationBeep = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a pleasant notification sound (two-tone beep)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.1,
        audioContext.currentTime + 0.01,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      // Resolve after the sound finishes
      setTimeout(() => resolve(), 350);
    } catch (error) {
      console.warn("Web Audio API notification failed:", error);
      resolve(); // Don't fail - just continue silently
    }
  });
};

/**
 * Simplified Engine sound - creates new instances for 100% reliability
 */
let currentEngineSound: { stop: () => void } | null = null;

const createEngineSound = () => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    const startTime = audioContext.currentTime;

    // Cria múltiplos osciladores para som mais rico
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();

    const gain1 = audioContext.createGain();
    const gain2 = audioContext.createGain();
    const gain3 = audioContext.createGain();
    const masterGain = audioContext.createGain();

    // Conecta osciladores
    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);
    masterGain.connect(audioContext.destination);

    // Configuração para som de nave espacial futurística
    osc1.type = "sine";
    osc2.type = "sine";
    osc3.type = "triangle";

    // Frequências base e harmônicos
    osc1.frequency.setValueAtTime(120, startTime);
    osc2.frequency.setValueAtTime(240, startTime); // oitava
    osc3.frequency.setValueAtTime(180, startTime); // quinta

    // Modulação sutil para som vivo
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(3, startTime);
    lfoGain.gain.setValueAtTime(8, startTime);

    // Volumes individuais
    gain1.gain.setValueAtTime(0.04, startTime);
    gain2.gain.setValueAtTime(0.02, startTime);
    gain3.gain.setValueAtTime(0.015, startTime);

    // Envelope de volume master com fade-in rápido
    masterGain.gain.setValueAtTime(0, startTime);
    masterGain.gain.linearRampToValueAtTime(1, startTime + 0.1);

    // Inicia osciladores
    const oscillators = [osc1, osc2, osc3, lfo];
    oscillators.forEach((osc) => osc.start(startTime));

    // Retorna controle para parar
    return {
      stop: () => {
        try {
          const stopTime = audioContext.currentTime;
          masterGain.gain.linearRampToValueAtTime(0, stopTime + 0.1);

          setTimeout(() => {
            oscillators.forEach((osc) => {
              try {
                osc.stop();
              } catch (e) {
                // Ignora erros
              }
            });
            audioContext.close();
          }, 150);
        } catch (error) {
          console.warn("Engine sound stop failed:", error);
        }
      },
    };
  } catch (error) {
    console.warn("Engine sound creation failed:", error);
    return { stop: () => {} };
  }
};

// Funções de conveniência
export const playNotificationSound = (): Promise<void> => {
  // Tenta o Web Audio API primeiro (mais confiável)
  return playNotificationBeep().catch(() => {
    // Fallback para arquivo MP3
    return playSound(Sounds.NOTIFICATION, 0.5).catch((error) => {
      console.warn("Both notification methods failed:", error.message);
      // Não lança erro para sons de notificação - eles não são críticos
    });
  });
};

export const startEngineSound = (): void => {
  // Para o som anterior se existir
  if (currentEngineSound) {
    currentEngineSound.stop();
  }

  // Cria e inicia novo som imediatamente
  currentEngineSound = createEngineSound();
};

export const stopEngineSound = (): void => {
  if (currentEngineSound) {
    currentEngineSound.stop();
    currentEngineSound = null;
  }
};

// Shared AudioContext for better resource management
let sharedAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }

  // Resume context if suspended
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext
      .resume()
      .catch((err) => console.warn("Failed to resume audio context:", err));
  }

  return sharedAudioContext;
};

/**
 * Creates a movement sound using shared AudioContext for reliability
 */
const createMovementSound = (
  velocity: number,
  maxVelocity: number,
): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = getAudioContext();

      const normalizedVelocity = Math.min(velocity / maxVelocity, 1);

      // Only play if there's significant velocity
      if (normalizedVelocity < 0.05) {
        resolve();
        return;
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      // Connect audio chain for cleaner sound
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Clean sine wave for futuristic feel
      oscillator.type = "sine";

      // Base frequency with velocity modulation - higher and more audible
      const baseFreq = 220;
      const targetFreq = baseFreq + normalizedVelocity * 120;
      oscillator.frequency.setValueAtTime(targetFreq, audioContext.currentTime);

      // High-pass filter for crystalline clarity
      filter.type = "highpass";
      filter.frequency.setValueAtTime(180, audioContext.currentTime);
      filter.Q.setValueAtTime(0.3, audioContext.currentTime);

      // Volume based on velocity - more audible
      const volume = normalizedVelocity * 0.15;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume,
        audioContext.currentTime + 0.03,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.15,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);

      setTimeout(() => resolve(), 180);
    } catch (error) {
      console.warn("Movement sound failed:", error);
      resolve();
    }
  });
};

export const playMovementSound = (
  velocity: number,
  maxVelocity: number,
): Promise<void> => {
  return createMovementSound(velocity, maxVelocity).catch((error) => {
    console.warn("Movement sound failed:", error.message);
  });
};

// Keep empty functions for compatibility but use different approach
export const startSpaceshipMovementSound = (): void => {
  // Not used - will use playMovementSound instead
};

export const updateSpaceshipMovementSound = (
  velocity: number,
  maxVelocity: number,
): void => {
  // Not used - will use playMovementSound instead
};

export const stopSpaceshipMovementSound = (): void => {
  // Not used - will use playMovementSound instead
};

export const playBarrierCollisionSound = (): Promise<void> => {
  return playCollisionSound().catch((error) => {
    console.warn("Collision sound failed:", error.message);
  });
};

/**
 * Creates an auto pilot activation sound using Web Audio API
 */
const createAutoPilotActivationSound = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const startTime = audioContext.currentTime;

      // Create oscillators for a futuristic activation sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      const gain2 = audioContext.createGain();
      const masterGain = audioContext.createGain();

      // Connect audio nodes
      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(masterGain);
      gain2.connect(masterGain);
      masterGain.connect(audioContext.destination);

      // Configure oscillators for a sci-fi activation sound
      osc1.type = "sine";
      osc2.type = "triangle";

      // Rising tone sequence - sounds like system activation
      osc1.frequency.setValueAtTime(220, startTime);
      osc1.frequency.exponentialRampToValueAtTime(440, startTime + 0.3);
      osc1.frequency.exponentialRampToValueAtTime(880, startTime + 0.6);

      osc2.frequency.setValueAtTime(330, startTime + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(660, startTime + 0.4);
      osc2.frequency.exponentialRampToValueAtTime(1320, startTime + 0.7);

      // Volume envelopes for smooth activation sound
      gain1.gain.setValueAtTime(0, startTime);
      gain1.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

      gain2.gain.setValueAtTime(0, startTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.05, startTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);

      // Master volume
      masterGain.gain.setValueAtTime(1, startTime);

      // Start and stop oscillators
      osc1.start(startTime);
      osc1.stop(startTime + 0.8);

      osc2.start(startTime + 0.1);
      osc2.stop(startTime + 0.9);

      setTimeout(() => resolve(), 1000);
    } catch (error) {
      console.warn("Auto pilot activation sound failed:", error);
      resolve();
    }
  });
};

export const playAutoPilotActivationSound = (): Promise<void> => {
  return createAutoPilotActivationSound().catch((error) => {
    console.warn("Auto pilot activation sound failed:", error.message);
  });
};

/**
 * Creates a bright laser shooting sound using Web Audio API
 */
const createLaserShootSound = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const startTime = audioContext.currentTime;

      // Create oscillators for a bright laser sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const osc3 = audioContext.createOscillator();

      const gain1 = audioContext.createGain();
      const gain2 = audioContext.createGain();
      const gain3 = audioContext.createGain();
      const masterGain = audioContext.createGain();

      // Add some filtering for a crisp sound
      const filter = audioContext.createBiquadFilter();

      // Connect audio nodes
      osc1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(gain3);

      gain1.connect(filter);
      gain2.connect(filter);
      gain3.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(audioContext.destination);

      // Configure filter for bright, crisp laser sound
      filter.type = "highpass";
      filter.frequency.setValueAtTime(800, startTime);
      filter.Q.setValueAtTime(2, startTime);

      // Configure oscillators for a sci-fi laser sound
      osc1.type = "sawtooth";
      osc2.type = "square";
      osc3.type = "sine";

      // Rapidly descending frequencies for classic laser "pew" sound
      osc1.frequency.setValueAtTime(1800, startTime);
      osc1.frequency.exponentialRampToValueAtTime(300, startTime + 0.08);

      osc2.frequency.setValueAtTime(2200, startTime);
      osc2.frequency.exponentialRampToValueAtTime(400, startTime + 0.06);

      osc3.frequency.setValueAtTime(3000, startTime);
      osc3.frequency.exponentialRampToValueAtTime(600, startTime + 0.05);

      // Volume envelopes for sharp attack and quick decay
      gain1.gain.setValueAtTime(0, startTime);
      gain1.gain.linearRampToValueAtTime(0.15, startTime + 0.005);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

      gain2.gain.setValueAtTime(0, startTime);
      gain2.gain.linearRampToValueAtTime(0.08, startTime + 0.003);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);

      gain3.gain.setValueAtTime(0, startTime);
      gain3.gain.linearRampToValueAtTime(0.05, startTime + 0.002);
      gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

      // Master volume
      masterGain.gain.setValueAtTime(0.6, startTime);

      // Start and stop oscillators
      osc1.start(startTime);
      osc1.stop(startTime + 0.08);

      osc2.start(startTime);
      osc2.stop(startTime + 0.06);

      osc3.start(startTime);
      osc3.stop(startTime + 0.05);

      setTimeout(() => resolve(), 100);
    } catch (error) {
      console.warn("Laser shoot sound failed:", error);
      resolve();
    }
  });
};

export const playLaserShootSound = (): Promise<void> => {
  return createLaserShootSound().catch((error) => {
    console.warn("Laser shoot sound failed:", error.message);
  });
};

/**
 * Creates a spaceship landing sound using Web Audio API
 */
const createLandingSound = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const startTime = audioContext.currentTime;

      // Create oscillators for a landing sequence sound
      const osc1 = audioContext.createOscillator(); // Engine sound
      const osc2 = audioContext.createOscillator(); // Landing thrusters
      const osc3 = audioContext.createOscillator(); // Atmospheric entry

      const gain1 = audioContext.createGain();
      const gain2 = audioContext.createGain();
      const gain3 = audioContext.createGain();
      const masterGain = audioContext.createGain();

      // Add filtering for atmospheric entry effect
      const filter = audioContext.createBiquadFilter();
      const filter2 = audioContext.createBiquadFilter();

      // Connect audio nodes
      osc1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(filter);

      gain1.connect(masterGain);
      gain2.connect(filter2);
      filter.connect(gain3);
      filter2.connect(masterGain);
      gain3.connect(masterGain);
      masterGain.connect(audioContext.destination);

      // Configure filters
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, startTime);
      filter.frequency.linearRampToValueAtTime(200, startTime + 2.0);

      filter2.type = "bandpass";
      filter2.frequency.setValueAtTime(300, startTime);
      filter2.Q.setValueAtTime(3, startTime);

      // Configure oscillators for landing sequence
      osc1.type = "sine"; // Main engine
      osc2.type = "triangle"; // Thrusters
      osc3.type = "sawtooth"; // Atmospheric entry

      // Landing sequence frequencies
      // Phase 1: Approach (0-0.8s)
      osc1.frequency.setValueAtTime(150, startTime);
      osc1.frequency.linearRampToValueAtTime(120, startTime + 0.8);

      // Phase 2: Thrusters activate (0.5-1.5s)
      osc2.frequency.setValueAtTime(220, startTime + 0.5);
      osc2.frequency.linearRampToValueAtTime(180, startTime + 1.5);

      // Phase 3: Atmospheric entry/landing (0.3-2.0s)
      osc3.frequency.setValueAtTime(80, startTime + 0.3);
      osc3.frequency.exponentialRampToValueAtTime(60, startTime + 2.0);

      // Volume envelopes for realistic landing sequence
      // Main engine
      gain1.gain.setValueAtTime(0.08, startTime);
      gain1.gain.linearRampToValueAtTime(0.12, startTime + 0.5);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 2.2);

      // Thrusters (pulse pattern)
      gain2.gain.setValueAtTime(0, startTime);
      gain2.gain.setValueAtTime(0, startTime + 0.5);
      gain2.gain.linearRampToValueAtTime(0.06, startTime + 0.6);
      gain2.gain.setValueAtTime(0.06, startTime + 0.8);
      gain2.gain.setValueAtTime(0.02, startTime + 0.9);
      gain2.gain.setValueAtTime(0.06, startTime + 1.0);
      gain2.gain.setValueAtTime(0.02, startTime + 1.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 1.8);

      // Atmospheric entry
      gain3.gain.setValueAtTime(0, startTime);
      gain3.gain.setValueAtTime(0, startTime + 0.3);
      gain3.gain.linearRampToValueAtTime(0.04, startTime + 0.5);
      gain3.gain.linearRampToValueAtTime(0.08, startTime + 1.2);
      gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);

      // Master volume with gentle fade out
      masterGain.gain.setValueAtTime(0.7, startTime);
      masterGain.gain.setValueAtTime(0.7, startTime + 1.8);
      masterGain.gain.linearRampToValueAtTime(0, startTime + 2.5);

      // Start and stop oscillators
      osc1.start(startTime);
      osc1.stop(startTime + 2.3);

      osc2.start(startTime + 0.5);
      osc2.stop(startTime + 1.9);

      osc3.start(startTime + 0.3);
      osc3.stop(startTime + 2.1);

      setTimeout(() => resolve(), 2600);
    } catch (error) {
      console.warn("Landing sound failed:", error);
      resolve();
    }
  });
};

export const playLandingSound = (): Promise<void> => {
  return createLandingSound().catch((error) => {
    console.warn("Landing sound failed:", error.message);
  });
};
