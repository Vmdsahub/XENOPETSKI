import React from "react";
import { motion } from "framer-motion";
import { GalaxyMap } from "../World/GalaxyMap";
import { VolumeControl } from "../Audio/VolumeControl";

export const WorldScreen: React.FC = () => {
  return (
    <div className="max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Galaxy Map Card */}
        <motion.div
          className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1"></div>
              <div className="text-xl text-gray-900 font-medium">Xenoverse</div>
              <div className="flex-1 flex justify-end">
                <VolumeControl />
              </div>
            </div>
          </div>

          {/* Galaxy Map */}
          <div className="p-4">
            <GalaxyMap />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
