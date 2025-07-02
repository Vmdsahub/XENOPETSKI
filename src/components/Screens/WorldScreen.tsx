import React from "react";
import { motion } from "framer-motion";

export const WorldScreen: React.FC = () => {
  return (
    <div className="max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-center h-96 bg-gray-100 rounded-2xl"
      >
        <div className="text-center text-gray-500">
          <h2 className="text-xl font-semibold mb-2">Mundo</h2>
          <p className="text-sm">Em desenvolvimento...</p>
        </div>
      </motion.div>
    </div>
  );
};
