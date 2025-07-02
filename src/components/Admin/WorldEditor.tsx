import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Move, Maximize2 } from "lucide-react";
import { gameService } from "../../services/gameService";
import { WorldPosition } from "../../types/game";

interface WorldEditorProps {
  world: WorldPosition;
  onUpdate: (worldId: string, updates: Partial<WorldPosition>) => void;
  isSelected: boolean;
  onSelect: () => void;
}

export const WorldEditor: React.FC<WorldEditorProps> = ({
  world,
  onUpdate,
  isSelected,
  onSelect,
}) => {
  // Defensive check for undefined world
  if (!world) {
    return null;
  }

  const [localSize, setLocalSize] = useState(world.size);
  const [localRotation, setLocalRotation] = useState(world.rotation);

  const handleSizeChange = useCallback(
    async (newSize: number) => {
      setLocalSize(newSize);
      const success = await gameService.updateWorldPosition(world.id, {
        size: newSize,
      });
      if (success) {
        onUpdate(world.id, { size: newSize });
      }
    },
    [world.id, onUpdate],
  );

  const handleRotationChange = useCallback(
    async (newRotation: number) => {
      setLocalRotation(newRotation);
      const success = await gameService.updateWorldPosition(world.id, {
        rotation: newRotation,
      });
      if (success) {
        onUpdate(world.id, { rotation: newRotation });
      }
    },
    [world.id, onUpdate],
  );

  if (!isSelected) {
    return (
      <motion.div
        className="fixed top-4 right-4 bg-white rounded-2xl shadow-xl p-4 border border-gray-200 z-50"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="text-center">
          <Move className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            Clique em um mundo para editar
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed top-4 right-4 bg-white rounded-2xl shadow-xl p-6 border border-gray-200 z-50 w-80"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 mb-1">{world.name}</h3>
        <p className="text-sm text-gray-600">ID: {world.id}</p>
      </div>

      {/* Size Control */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Maximize2 className="w-4 h-4 text-blue-600" />
          <label className="text-sm font-medium text-gray-700">Tamanho</label>
          <span className="text-sm text-gray-500">
            ({Math.round(localSize)})
          </span>
        </div>
        <input
          type="range"
          min="20"
          max="200"
          value={localSize}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
          className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
              ((localSize - 20) / (200 - 20)) * 100
            }%, #cbd5e1 ${((localSize - 20) / (200 - 20)) * 100}%, #cbd5e1 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>20</span>
          <span>200</span>
        </div>
      </div>

      {/* Rotation Control */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <RotateCcw className="w-4 h-4 text-purple-600" />
          <label className="text-sm font-medium text-gray-700">Rotação</label>
          <span className="text-sm text-gray-500">
            ({Math.round((localRotation * 180) / Math.PI)}°)
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={Math.PI * 2}
          step="0.01"
          value={localRotation}
          onChange={(e) => handleRotationChange(Number(e.target.value))}
          className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${
              (localRotation / (Math.PI * 2)) * 100
            }%, #cbd5e1 ${(localRotation / (Math.PI * 2)) * 100}%, #cbd5e1 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0°</span>
          <span>360°</span>
        </div>
      </div>

      {/* Position Info */}
      <div className="bg-gray-50 rounded-xl p-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Posição</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">X:</span>
            <span className="ml-1 font-mono text-gray-900">
              {Math.round(world.x)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Y:</span>
            <span className="ml-1 font-mono text-gray-900">
              {Math.round(world.y)}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Arraste o mundo no mapa para alterar a posição
        </p>
      </div>
    </motion.div>
  );
};
