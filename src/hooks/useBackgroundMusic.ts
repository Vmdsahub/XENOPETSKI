import { useEffect, useState, useCallback } from "react";
import {
  backgroundMusicService,
  MusicTrack,
} from "../services/backgroundMusicService";

export interface UseBackgroundMusicReturn {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: MusicTrack | null;
  tracks: MusicTrack[];
  volume: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => void;
}

/**
 * Hook para controlar a música de fundo da navegação galáctica
 */
export const useBackgroundMusic = (): UseBackgroundMusicReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [volume, setVolumeState] = useState(0.3);

  // Atualiza o estado baseado no serviço
  const updateState = useCallback(() => {
    setIsPlaying(backgroundMusicService.getIsPlaying());
    setIsPaused(backgroundMusicService.getIsPaused());
    setCurrentTrack(backgroundMusicService.getCurrentTrack());
    setVolumeState(backgroundMusicService.getVolume());
  }, []);

  // Funções de controle
  const play = useCallback(async () => {
    await backgroundMusicService.play();
    updateState();
  }, [updateState]);

  const pause = useCallback(async () => {
    await backgroundMusicService.pause();
    updateState();
  }, [updateState]);

  const stop = useCallback(async () => {
    await backgroundMusicService.stop();
    updateState();
  }, [updateState]);

  const nextTrack = useCallback(async () => {
    await backgroundMusicService.nextTrack();
    updateState();
  }, [updateState]);

  const previousTrack = useCallback(async () => {
    await backgroundMusicService.previousTrack();
    updateState();
  }, [updateState]);

  const setVolume = useCallback(
    (newVolume: number) => {
      console.log("🔊 Hook: Mudando volume para:", newVolume);
      backgroundMusicService.setVolume(newVolume);
      setVolumeState(newVolume); // Atualiza estado imediatamente
      updateState();
    },
    [updateState],
  );

  // Atualiza estado inicial e monitora mudanças
  useEffect(() => {
    updateState();

    // Polling simples para detectar mudanças (como fim de faixa)
    const interval = setInterval(updateState, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [updateState]);

  // Cleanup quando componente desmonta
  useEffect(() => {
    return () => {
      // Para a música quando o hook é desmontado
      backgroundMusicService.pause().catch(() => {
        // Ignora erros durante cleanup
      });
    };
  }, []);

  return {
    isPlaying,
    isPaused,
    currentTrack,
    tracks: backgroundMusicService.getTracks(),
    volume,
    play,
    pause,
    stop,
    nextTrack,
    previousTrack,
    setVolume,
  };
};
