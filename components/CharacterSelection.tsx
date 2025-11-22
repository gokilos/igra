import React, { useState } from 'react';
import { Character } from '../types';

interface CharacterSelectionProps {
  characters: Character[];
  onSelect: (character: Character) => void;
}

export const CharacterSelection: React.FC<CharacterSelectionProps> = ({ characters, onSelect }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentCharacter = characters[currentIndex];
  const isSanmundon = currentCharacter?.id === 'sanmundon' || currentCharacter?.imagePath === '/sanmundondo.png';

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev === 0 ? characters.length - 1 : prev - 1));
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev === characters.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsAnimating(false), 500);
  };

  const getStatColor = (value: number) => {
    if (value >= 80) return 'from-squid-green to-green-400';
    if (value >= 50) return 'from-cyan-500 to-cyan-400';
    return 'from-squid-pink to-pink-400';
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-purple-900/20 via-squid-dark to-teal-900/20">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-squid-pink/5 via-transparent to-transparent animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-radial from-teal-500/5 via-transparent to-transparent animate-pulse animation-delay-500"></div>
      </div>

      {/* Title */}
      <div className="absolute top-2 left-0 right-0 z-50 animate-fadeIn">
        <h1 className="text-4xl sm:text-5xl font-black tracking-widest text-center text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          Выберите персонажа
        </h1>
      </div>

      {/* Character Display Area */}
      <div className="relative z-10 flex items-center justify-center w-full max-w-6xl px-4 sm:px-8">

        {/* Left Arrow */}
        <button
          onClick={handlePrevious}
          disabled={isAnimating}
          className="group fixed top-1/2 -translate-y-1/2 left-4 sm:left-8 z-50 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-squid-pink to-pink-600 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative w-0 h-0 border-t-[20px] sm:border-t-[25px] border-t-transparent border-r-[30px] sm:border-r-[40px] border-r-squid-pink border-b-[20px] sm:border-b-[25px] border-b-transparent group-hover:border-r-pink-400 transition-colors"></div>
        </button>

        {/* Character Container */}
        <div className="flex flex-col items-center w-full max-w-lg mx-auto">

          {/* Character Image with Glow */}
          <div className={`relative mt-2 mb-6 ${isSanmundon ? 'w-64 h-80 sm:w-80 sm:h-96' : 'w-80 h-[28rem] sm:w-[32rem] sm:h-[36rem]'} flex items-center justify-center`}>
            {/* Green Gradient Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-teal-400/30 via-green-500/40 to-transparent rounded-full blur-3xl animate-pulse"></div>

            {/* Character Image Placeholder */}
            <div className={`relative w-full h-full flex items-center justify-center transition-all duration-500 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
              <img
                src={currentCharacter.imagePath || '/characters/default.png'}
                alt={currentCharacter.name}
                className="w-full h-full object-contain drop-shadow-2xl"
                onError={(e) => {
                  // Fallback to silhouette if image not found
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-screen h-28 z-0 bg-gradient-to-t from-squid-dark via-squid-dark/60 to-transparent"></div>
              {/* Fallback Silhouette */}
              <div className="hidden absolute inset-0 flex items-end justify-center">
                <div className="w-48 h-72 bg-gradient-to-t from-teal-500/50 to-teal-300/30 rounded-t-full shadow-[0_0_50px_rgba(20,184,166,0.5)]"></div>
              </div>
            </div>
          </div>

          
        </div>

        {/* Right Arrow */}
        <button
          onClick={handleNext}
          disabled={isAnimating}
          className="group fixed top-1/2 -translate-y-1/2 right-4 sm:right-8 z-50 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-gradient-to-l from-squid-pink to-pink-600 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative w-0 h-0 border-t-[20px] sm:border-t-[25px] border-t-transparent border-l-[30px] sm:border-l-[40px] border-l-squid-pink border-b-[20px] sm:border-b-[25px] border-b-transparent group-hover:border-l-pink-400 transition-colors"></div>
        </button>
      </div>

      {/* Bottom Fixed Info + Select Button */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 sm:px-8 pb-4">
        <div className="max-w-lg mx-auto">
          <div className={`w-full bg-gradient-to-b from-squid-panel to-gray-900 border-2 border-squid-pink rounded-2xl p-4 shadow-[0_0_30px_rgba(255,0,122,0.4)] transition-all duration-500 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-2 bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent tracking-wider">
              {currentCharacter.name}
            </h2>
            <p className="text-gray-300 text-sm sm:text-base text-center mb-2 leading-relaxed px-2">
              {currentCharacter.description}
            </p>
          </div>
          <button onClick={() => onSelect(currentCharacter)} className="mt-3 w-full max-w-sm px-6 py-3 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500 hover:from-teal-400 hover:via-cyan-300 hover:to-teal-400 text-black text-lg sm:text-xl font-black tracking-widest rounded-full transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(20,184,166,0.6)] hover:shadow-[0_0_50px_rgba(20,184,166,0.9)]">
            Выбрать
          </button>
        </div>
      </div>

      {/* Character Indicator Dots */}
      <div className="relative z-10 mt-8 flex gap-2 animate-fadeIn animation-delay-600">
        {characters.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (!isAnimating && index !== currentIndex) {
                setIsAnimating(true);
                setCurrentIndex(index);
                setTimeout(() => setIsAnimating(false), 500);
              }
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-squid-pink w-8 shadow-[0_0_10px_rgba(255,0,122,0.8)]'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
