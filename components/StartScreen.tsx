import React from 'react';

interface StartScreenProps {
  onStart: () => void;
}

// Check if dev mode is enabled
const IS_DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-gray-900 via-squid-dark to-black">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source srcSet="/glavnaya.webp" type="image/webp" />
          <img
            src="/glavnaya.png"
            alt="Главная"
            className="w-full h-full object-cover object-center opacity-40"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-squid-dark/50 to-squid-dark"></div>
      </div>

      {/* Top Logo */}
      <div className="relative z-10 w-full">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 animate-fadeIn">
          <picture>
            <source srcSet="/лого.webp" type="image/webp" />
            <img
              src="/лого.png"
              alt="Логотип"
              className="mx-auto w-40 sm:w-56 object-contain"
            />
          </picture>
        </div>
      </div>

      {/* Bottom Actions and Info */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 pb-4">
        <button
          onClick={onStart}
          className="group relative px-12 py-5 bg-gradient-to-r from-squid-pink to-pink-600 hover:from-pink-600 hover:to-squid-pink text-white text-xl font-black tracking-widest rounded-lg overflow-hidden transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(255,0,122,0.5)] hover:shadow-[0_0_50px_rgba(255,0,122,0.8)] animate-fadeIn"
        >
          <span className="relative z-10">НАЧАТЬ ИГРУ</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          <div className="absolute inset-0 rounded-lg animate-ping opacity-20 bg-squid-pink"></div>
        </button>

        <div className="text-center space-y-2 animate-fadeIn">
          {IS_DEV_MODE && (
            <div className="bg-yellow-500/20 border border-yellow-500 rounded px-3 py-1 mb-2">
              <p className="text-yellow-400 text-xs font-mono font-bold">
                🔧 РЕЖИМ РАЗРАБОТКИ
              </p>
            </div>
          )}
          <p className="text-gray-600 text-xs font-mono">
            SQUID GAME • SURVIVAL CHALLENGE
          </p>
          <p className="text-gray-700 text-[10px] font-mono">
            СЕРВЕР: ХАКАСИЯ-1 • ОНЛАЙН
          </p>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-20 h-20 border-4 border-squid-pink/30 rounded-full animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 border-4 border-squid-green/20 rounded-full animate-pulse animation-delay-500"></div>
      <div className="absolute top-1/3 right-20 w-16 h-16 border-4 border-white/10 rotate-45 animate-pulse animation-delay-300"></div>
    </div>
  );
};
