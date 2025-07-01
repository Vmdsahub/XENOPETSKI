import React from "react";
import { motion } from "framer-motion";
import { DetailView } from "../World/DetailView";
import { useGameStore } from "../../store/gameStore";

export const WorldDetailScreen: React.FC = () => {
  const { setCurrentScreen, selectedWorld, setSelectedWorld } = useGameStore();

  const handleBack = () => {
    setSelectedWorld(null); // Clear selected world
    setCurrentScreen("world");
  };

  // Use selected world data from store, fallback to default
  const worldData = selectedWorld || {
    id: "default-world",
    name: "Mundo Padrão",
    description: "Explore este fascinante mundo e suas maravilhas",
    type: "world",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fbd58c52f19d147f09ff36547a19e0305?format=webp&width=1600",
  };

  return (
    <div className="max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.3 }}
      >
        <DetailView pointData={worldData} onBack={handleBack} />
      </motion.div>
    </div>
  );
};
