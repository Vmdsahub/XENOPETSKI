import { useCallback, useRef } from "react";
import { useGameStore } from "../store/gameStore";

/**
 * Hook para persistir o estado da nave de forma otimizada
 * Evita salvar a cada frame usando throttling
 */
export const useShipStatePersistence = () => {
  const { updateShipState } = useGameStore();
  const lastSaveTime = useRef(0);
  const saveIntervalMs = 1000; // Salvar a cada 1 segundo

  const saveShipState = useCallback(
    (shipState: {
      x: number;
      y: number;
      angle: number;
      vx: number;
      vy: number;
      cameraX: number;
      cameraY: number;
    }) => {
      const now = Date.now();
      if (now - lastSaveTime.current >= saveIntervalMs) {
        updateShipState(shipState);
        lastSaveTime.current = now;
      }
    },
    [updateShipState, saveIntervalMs],
  );

  const forceSaveShipState = useCallback(
    (shipState: {
      x: number;
      y: number;
      angle: number;
      vx: number;
      vy: number;
      cameraX: number;
      cameraY: number;
    }) => {
      updateShipState(shipState);
      lastSaveTime.current = Date.now();
    },
    [updateShipState],
  );

  return { saveShipState, forceSaveShipState };
};
