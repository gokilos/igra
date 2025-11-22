import React from 'react';

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-gray-900 via-squid-dark to-black">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/start-background.jpg"
          alt="Start Background"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-squid-dark/50 to-squid-dark"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 space-y-8">
        {/* Logo/Title */}
        <div className="text-center space-y-4 animate-fadeIn">
          <h1 className="text-5xl sm:text-7xl font-black tracking-widest text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
            ИГРА В
          </h1>
          <h2 className="text-6xl sm:text-8xl font-black tracking-widest text-squid-pink drop-shadow-[0_0_30px_rgba(255,0,122,0.8)]">
            КАЛЬМАРА
          </h2>
        </div>

        {/* Subtitle */}
        <p className="text-gray-400 text-lg sm:text-xl font-mono tracking-wide text-center max-w-md animate-fadeIn animation-delay-300">
          Выживи в смертельной игре разума
        </p>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="group relative mt-8 px-12 py-5 bg-gradient-to-r from-squid-pink to-pink-600 hover:from-pink-600 hover:to-squid-pink text-white text-xl font-black tracking-widest rounded-lg overflow-hidden transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(255,0,122,0.5)] hover:shadow-[0_0_50px_rgba(255,0,122,0.8)] animate-fadeIn animation-delay-600"
        >
          <span className="relative z-10">НАЧАТЬ ИГРУ</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>

          {/* Pulse animation */}
          <div className="absolute inset-0 rounded-lg animate-ping opacity-20 bg-squid-pink"></div>
        </button>

        {/* Footer Info */}
        <div className="absolute bottom-8 text-center space-y-2 animate-fadeIn animation-delay-900">
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
