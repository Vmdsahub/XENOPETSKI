/**
 * BackgroundMusicService - Gerenciador de música de fundo para navegação galáctica
 */

export interface MusicTrack {
  id: string;
  name: string;
  path: string;
  duration?: number;
}

class BackgroundMusicService {
  private tracks: MusicTrack[] = [
    {
      id: "galaxy-1",
      name: "Silent Starscape",
      path: "/sounds/galaxy-music-1.mp3",
    },
    {
      id: "galaxy-2",
      name: "Silent Starscape",
      path: "/sounds/galaxy-music-2.mp3",
    },
    {
      id: "galaxy-3",
      name: "Whispers of the Stars",
      path: "/sounds/galaxy-music-3.mp3",
    },
    {
      id: "galaxy-4",
      name: "Wanderers Among the Stars",
      path: "/sounds/galaxy-music-4.mp3",
    },
    {
      id: "galaxy-5",
      name: "Across the Silent Stars",
      path: "/sounds/galaxy-music-5.mp3",
    },
    {
      id: "galaxy-6",
      name: "Galactic Whisper",
      path: "/sounds/galaxy-music-6.mp3",
    },
    {
      id: "galaxy-7",
      name: "Galactic Whisper",
      path: "/sounds/galaxy-music-7.mp3",
    },
    {
      id: "galaxy-8",
      name: "Silent Horizons",
      path: "/sounds/galaxy-music-8.mp3",
    },
    {
      id: "galaxy-9",
      name: "Echoes in the Void",
      path: "/sounds/galaxy-music-9.mp3",
    },
  ];

  private originalTracks: MusicTrack[];

  private currentTrack: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private volume: number = 0.3;

  // Synthetic music properties
  private syntheticAudioContext: AudioContext | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private masterGainNode: GainNode | null = null;
  private isUsingSynthetic: boolean = false;

  constructor() {
    console.log("🎵 Inicializando BackgroundMusicService...");
    this.originalTracks = [...this.tracks];
    this.checkForRealMusic();
  }

  /**
   * Verifica se há arquivos de música reais disponíveis
   */
  private async checkForRealMusic(): Promise<void> {
    console.log("🔍 Verificando arquivos de música...");

    try {
      // Testa o primeiro arquivo para ver se existe
      const testAudio = new Audio(this.tracks[0].path);

      const canLoad = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.log("⏰ Timeout - usando música sintética");
          resolve(false);
        }, 3000);

        testAudio.addEventListener(
          "canplaythrough",
          () => {
            clearTimeout(timeout);
            console.log("✅ Arquivos de música detectados!");
            resolve(true);
          },
          { once: true },
        );

        testAudio.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            console.log(
              "❌ Arquivos não encontrados - usando música sintética",
            );
            resolve(false);
          },
          { once: true },
        );

        testAudio.load();
      });

      if (canLoad) {
        console.log("🎵 Usando arquivos de música reais");
        this.isUsingSynthetic = false;
      } else {
        this.setupSyntheticMusic();
      }
    } catch (error) {
      console.warn(
        "Erro ao verificar arquivos, usando música sintética:",
        error,
      );
      this.setupSyntheticMusic();
    }
  }

  /**
   * Configura música sintética
   */
  private setupSyntheticMusic(): void {
    this.isUsingSynthetic = true;
    this.tracks = [
      { id: "synthetic-1", name: "Nebula Drift", path: "synthetic" },
      { id: "synthetic-2", name: "Cosmic Winds", path: "synthetic" },
      { id: "synthetic-3", name: "Deep Void", path: "synthetic" },
    ];

    try {
      this.syntheticAudioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      console.log("✅ Sistema de música sintética ativado");
    } catch (error) {
      console.warn("❌ Web Audio API não suportada:", error);
      this.isUsingSynthetic = false;
    }
  }

  /**
   * Inicia a reprodução da trilha sonora
   */
  async play(): Promise<void> {
    console.log("🎵 Play chamado. Estado:", {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isUsingSynthetic: this.isUsingSynthetic,
    });

    if (this.isPlaying && !this.isPaused) {
      console.log("⏸️ Já está tocando, ignorando");
      return;
    }

    try {
      if (this.isPaused && this.currentTrack && !this.isUsingSynthetic) {
        // Retoma da pausa
        console.log("▶️ Retomando da pausa...");
        this.isPaused = false;
        await this.currentTrack.play();
      } else {
        // Inicia nova faixa
        console.log("🎼 Iniciando nova faixa...");
        await this.playTrack(this.currentTrackIndex);
      }

      this.isPlaying = true;
      console.log("✅ Música iniciada com sucesso");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("user didn't interact")) {
        console.warn(
          "⚠️ Música bloqueada: precisa de interação do usuário primeiro",
        );
        return;
      }

      console.error("❌ Erro ao iniciar música de fundo:", error);
      throw error;
    }
  }

  /**
   * Pausa a reprodução
   */
  async pause(): Promise<void> {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;

    if (this.isUsingSynthetic && this.masterGainNode) {
      // Para música sintética, diminui volume
      try {
        this.masterGainNode.gain.linearRampToValueAtTime(
          0,
          (this.syntheticAudioContext?.currentTime || 0) + 0.1,
        );
      } catch (e) {
        // Ignora
      }
    } else if (this.currentTrack) {
      this.currentTrack.pause();
    }
  }

  /**
   * Para completamente a reprodução
   */
  async stop(): Promise<void> {
    this.isPlaying = false;
    this.isPaused = false;

    if (this.isUsingSynthetic) {
      this.stopSyntheticTrack();
    } else {
      if (this.currentTrack) {
        this.currentTrack.pause();
        this.currentTrack.currentTime = 0;
        this.currentTrack = null;
      }
    }
  }

  /**
   * Reproduz uma faixa específica
   */
  private async playTrack(index: number): Promise<void> {
    if (index < 0 || index >= this.tracks.length) return;

    const track = this.tracks[index];

    if (this.isUsingSynthetic) {
      this.playSyntheticTrack(index);
      return;
    }

    const audio = new Audio(track.path);
    audio.volume = this.volume;
    audio.loop = false;

    // Configura evento para próxima faixa
    audio.addEventListener("ended", () => {
      this.nextTrack();
    });

    try {
      await audio.play();
      this.currentTrack = audio;
      this.currentTrackIndex = index;
      console.log(`Reproduzindo: ${track.name}`);
    } catch (error) {
      console.error(`Erro ao reproduzir ${track.name}:`, error);
      this.nextTrack();
    }
  }

  /**
   * Reproduz uma faixa sintética usando Web Audio API
   */
  private playSyntheticTrack(index: number): void {
    if (!this.syntheticAudioContext) return;

    // Para osciladores anteriores
    this.stopSyntheticTrack();

    const ctx = this.syntheticAudioContext;

    // Cria master gain node para controle de volume
    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime);
    this.masterGainNode.connect(ctx.destination);

    // Frequências base para cada faixa (acordes diferentes)
    const chordConfigs = [
      [220, 261.63, 329.63], // Am chord - Lá menor
      [174.61, 220, 261.63], // Fm chord - Fá menor
      [146.83, 185, 233.08], // Dm chord - Ré menor
    ];

    const chordFreqs = chordConfigs[index % chordConfigs.length];

    // Cria osciladores para o acorde
    chordFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Volume diminui com harmônicos
      const volume = 0.3 / (i + 1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 3);

      osc.connect(gain);
      gain.connect(this.masterGainNode);

      osc.start();
      this.currentOscillators.push(osc);
    });

    // Adiciona uma melodia simples
    const melodyFreqs = [
      [330, 369.99, 415.3], // Melodia em Mi maior
      [261.63, 293.66, 329.63], // Melodia em Dó maior
      [220, 246.94, 277.18], // Melodia em Lá maior
    ];

    const melody = melodyFreqs[index % melodyFreqs.length];

    melody.forEach((freq, i) => {
      setTimeout(() => {
        if (this.isPlaying && this.isUsingSynthetic && this.masterGainNode) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq * 2, ctx.currentTime); // Oitava acima

          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.5);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

          osc.connect(gain);
          gain.connect(this.masterGainNode);

          osc.start();
          osc.stop(ctx.currentTime + 2);
        }
      }, i * 8000); // Nota a cada 8 segundos
    });

    this.currentTrackIndex = index;
    console.log(`🎵 Reproduzindo faixa sintética ${index + 1}`);

    // Auto próxima faixa após 180 segundos
    setTimeout(() => {
      if (this.isPlaying && this.isUsingSynthetic) {
        this.nextTrack();
      }
    }, 180000);
  }

  /**
   * Para faixas sintéticas
   */
  private stopSyntheticTrack(): void {
    this.currentOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {
        // Ignora erros se já parou
      }
    });
    this.currentOscillators = [];
    this.masterGainNode = null;
  }

  /**
   * Próxima faixa da playlist
   */
  async nextTrack(): Promise<void> {
    if (!this.isPlaying) return;

    const nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    await this.playTrack(nextIndex);
  }

  /**
   * Faixa anterior da playlist
   */
  async previousTrack(): Promise<void> {
    if (!this.isPlaying) return;

    const prevIndex =
      this.currentTrackIndex === 0
        ? this.tracks.length - 1
        : this.currentTrackIndex - 1;
    await this.playTrack(prevIndex);
  }

  /**
   * Define o volume (0 a 1)
   */
  setVolume(newVolume: number): void {
    console.log(
      "🔊 Service: Mudando volume de",
      this.volume,
      "para",
      newVolume,
    );
    const oldVolume = this.volume;
    this.volume = Math.max(0, Math.min(1, newVolume));

    if (this.isUsingSynthetic && this.masterGainNode) {
      // Para música sintética, ajusta volume do master gain
      try {
        const ctx = this.syntheticAudioContext;
        if (ctx) {
          this.masterGainNode.gain.linearRampToValueAtTime(
            this.volume * 0.2,
            ctx.currentTime + 0.1,
          );
          console.log("✅ Volume sintético ajustado para:", this.volume);
        }
      } catch (error) {
        console.warn("❌ Erro ao ajustar volume sintético:", error);
      }
    } else if (this.currentTrack) {
      // Para arquivos reais, ajusta volume diretamente
      this.currentTrack.volume = this.volume;
      console.log("✅ Volume real ajustado para:", this.volume);

      // Se estava mutado e agora tem volume, despause
      if (oldVolume === 0 && this.volume > 0 && this.isPaused) {
        this.currentTrack
          .play()
          .catch((e) => console.warn("Erro ao despausar:", e));
        this.isPaused = false;
      }
      // Se agora está mutado, pause
      else if (this.volume === 0 && this.isPlaying && !this.isPaused) {
        this.currentTrack.pause();
        this.isPaused = true;
      }
    }
  }

  /**
   * Obtém o volume atual
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Obtém informações da faixa atual
   */
  getCurrentTrack(): MusicTrack | null {
    return this.tracks[this.currentTrackIndex] || null;
  }

  /**
   * Obtém todas as faixas
   */
  getTracks(): MusicTrack[] {
    return [...this.tracks];
  }

  /**
   * Verifica se está reproduzindo
   */
  getIsPlaying(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  /**
   * Verifica se está pausado
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }
}

// Instância singleton
export const backgroundMusicService = new BackgroundMusicService();
