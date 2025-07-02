import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthScreen } from "./components/Auth/AuthScreen";

import { BottomNavigation } from "./components/Layout/BottomNavigation";

import { useAuthStore } from "./store/authStore";
import { useGameStore } from "./store/gameStore";
import { preloadAllSounds } from "./utils/soundManager";

// Componente para pré-carregar recursos de áudio
const AudioPreloader: React.FC = () => {
  useEffect(() => {
    // Pré-carrega todos os sons do jogo usando o SoundManager
    preloadAllSounds()
      .then(() =>
        console.log("🔊 Todos os sons foram pré-carregados com sucesso!"),
      )
      .catch((error) => console.error("❌ Erro ao pré-carregar sons:", error));
  }, []);

  return null; // Componente não renderiza nada
};

function App() {
  const { isAuthenticated, user: authUser, initializeAuth } = useAuthStore();
  const {
    currentScreen,
    user: gameUser,
    setUser,
    initializeNewUser,
    loadUserData,
    subscribeToRealtimeUpdates,
    unsubscribeFromRealtimeUpdates,
  } = useGameStore();

  // Initialize authentication on app start
  useEffect(() => {
    const init = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error("Auth initialization error:", error);
      }
    };
    init();
  }, []);

  // Enhanced sync logic with auth user and game user
  useEffect(() => {
    if (isAuthenticated && authUser) {
      const gameUserData = {
        id: authUser.id,
        email: authUser.email,
        username: authUser.username,
        phone: authUser.phone,
        isAdmin: authUser.isAdmin,
        language: authUser.language,
        accountScore: authUser.accountScore,
        daysPlayed: authUser.daysPlayed,
        totalXenocoins: authUser.totalXenocoins,
        createdAt: authUser.createdAt,
        lastLogin: authUser.lastLogin,
      };

      // Always update the user data and sync
      if (!gameUser || gameUser.id !== authUser.id) {
        // New user or different user
        initializeNewUser(gameUserData);
        loadUserData(authUser.id);
      } else {
        // Same user, update
        setUser(gameUserData);
      }
    } else if (!isAuthenticated && gameUser) {
      // User logged out, clear game data
      setUser(null);
    }
  }, [
    isAuthenticated,
    authUser?.id,
    authUser?.accountScore,
    authUser?.daysPlayed,
  ]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      if (isAuthenticated) {
        unsubscribeFromRealtimeUpdates();
      }
    };
  }, [isAuthenticated]);

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const renderScreen = () => {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 min-h-[80vh] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Container Principal
            </h1>
            <p className="text-lg text-gray-600">
              Navegue pelas abas no menu inferior
            </p>
            <div className="mt-8 text-sm text-gray-500">
              Aba atual: <span className="font-semibold">{currentScreen}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 },
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.4,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Componente de pré-carregamento de áudios */}
      <AudioPreloader />

      <main className="pb-24 px-4 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNavigation />
    </div>
  );
}

export default App;
