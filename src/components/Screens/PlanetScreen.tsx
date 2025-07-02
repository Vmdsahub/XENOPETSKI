import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Globe, Star } from "lucide-react";
import { useGameStore } from "../../store/gameStore";

interface Planet {
  id: string;
  name: string;
  color: string;
}

export const PlanetScreen: React.FC = () => {
  const { setCurrentScreen, currentPlanet } = useGameStore();

  if (!currentPlanet) {
    return null;
  }

  const handleBack = () => {
    setCurrentScreen("world");
  };

  // Gerar uma imagem placeholder baseada na cor do planeta
  const generatePlanetImage = (color: string) => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Cdefs%3E%3CradialGradient id='planet' cx='40%25' cy='40%25'%3E%3Cstop offset='0%25' stop-color='${encodeURIComponent(color)}' stop-opacity='1'/%3E%3Cstop offset='70%25' stop-color='${encodeURIComponent(color)}' stop-opacity='0.8'/%3E%3Cstop offset='100%25' stop-color='%23000' stop-opacity='0.6'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='%23000011'/%3E%3Ccircle cx='400' cy='300' r='200' fill='url(%23planet)' /%3E%3Ccircle cx='350' cy='250' r='15' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='420' cy='320' r='10' fill='%23ffffff' fill-opacity='0.2'/%3E%3Ccircle cx='450' cy='280' r='8' fill='%23ffffff' fill-opacity='0.4'/%3E%3C/svg%3E`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-xl bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-white" />
              <div>
                <h1 className="text-xl font-bold text-white">
                  {currentPlanet.name}
                </h1>
                <p className="text-white text-opacity-80 text-sm">
                  Exploração Planetária
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Planet Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <img
            src={generatePlanetImage(currentPlanet.color)}
            alt={`Superfície de ${currentPlanet.name}`}
            className="w-full h-96 object-cover"
          />

          {/* Overlay with planet info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-transparent via-50% to-transparent">
            <div className="absolute bottom-6 left-6 right-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="bg-black bg-opacity-60 backdrop-blur-sm rounded-2xl p-6 text-white"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: currentPlanet.color }}
                  />
                  <h2 className="text-2xl font-bold">{currentPlanet.name}</h2>
                </div>
                <p className="text-white text-opacity-90 mb-4">
                  Você pousou com sucesso em {currentPlanet.name}! Este mundo
                  misterioso aguarda sua exploração.
                </p>
                <div className="flex items-center gap-2 text-yellow-400">
                  <Star className="w-4 h-4" />
                  <span className="text-sm">
                    Missão: Explorar território desconhecido
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="space-y-4"
          >
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-2">
                Dados do Planeta
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Tipo:</span>
                  <p className="font-medium">Rochoso</p>
                </div>
                <div>
                  <span className="text-gray-600">Atmosfera:</span>
                  <p className="font-medium">Respirável</p>
                </div>
                <div>
                  <span className="text-gray-600">Gravidade:</span>
                  <p className="font-medium">0.8g</p>
                </div>
                <div>
                  <span className="text-gray-600">Temperatura:</span>
                  <p className="font-medium">15°C</p>
                </div>
              </div>
            </div>

            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Mais conteúdo de exploração será adicionado em breve!
              </p>
              <button
                onClick={handleBack}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Retornar ao Mapa Galáctico
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
