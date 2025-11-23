import React, { useState } from 'react';
import { GameMode } from '../types';

interface GameCard {
  id: GameMode;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  gradient: string;
  glowColor: string;
}

const GAME_CARDS: GameCard[] = [
  {
    id: GameMode.NUMBERS,
    title: 'УГАДАЙ ЧИСЛО',
    subtitle: 'Логическая игра',
    description: 'Разгадай 4-значный код оппонента раньше, чем он разгадает твой',
    icon: '🔢',
    gradient: 'from-yellow-400 via-yellow-500 to-orange-500',
    glowColor: 'rgba(255, 213, 0, 0.4)',
  },
  {
    id: GameMode.WORDS,
    title: 'УГАДАЙ СЛОВО',
    subtitle: 'Словесная дуэль',
    description: 'Отгадай слово оппонента буква за буквой. Кто быстрее - тот победил!',
    icon: '📝',
    gradient: 'from-blue-400 via-blue-500 to-indigo-600',
    glowColor: 'rgba(91, 139, 255, 0.4)',
  },
  {
    id: GameMode.BATTLESHIP,
    title: 'МОРСКОЙ БОЙ',
    subtitle: 'Тактическая битва',
    description: 'Расставь корабли и потопи флот противника! Классическая стратегия',
    icon: '🚢',
    gradient: 'from-cyan-400 via-teal-500 to-green-500',
    glowColor: 'rgba(0, 255, 133, 0.4)',
  },
];

interface GameSelectionProps {
  onSelectGame: (mode: GameMode) => void;
  playerName: string;
  playerAvatar?: string | null;
}

export const GameSelection: React.FC<GameSelectionProps> = ({
  onSelectGame,
  playerName,
  playerAvatar,
}) => {
  const [selectedCard, setSelectedCard] = useState<GameMode | null>(null);

  const handleCardClick = (mode: GameMode) => {
    setSelectedCard(mode);
    setTimeout(() => {
      onSelectGame(mode);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-squid-dark via-[#0D1129] to-squid-dark relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-squid-accent/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-squid-blue/10 rounded-full blur-3xl animate-pulse animation-delay-500"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-squid-purple/5 rounded-full blur-3xl animate-pulse animation-delay-300"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {playerAvatar ? (
              <img
                src={playerAvatar}
                alt={playerName}
                className="w-12 h-12 rounded-full border-2 border-squid-accent shadow-lg"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-squid-accent to-squid-yellow flex items-center justify-center text-2xl font-black text-squid-dark shadow-lg">
                {playerName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-lg">{playerName}</p>
              <p className="text-gray-400 text-xs">Выберите игру</p>
            </div>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
          <span className="bg-gradient-to-r from-squid-accent via-squid-yellow to-squid-accent bg-clip-text text-transparent">
            STREAMO
          </span>
        </h1>
        <p className="text-squid-accent/80 text-sm font-bold tracking-widest uppercase">
          Выбор игры
        </p>
      </div>

      {/* Game Cards */}
      <div className="relative z-10 px-6 pb-20 space-y-4">
        <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">
          Доступные игры
        </h2>

        {GAME_CARDS.map((game, index) => (
          <button
            key={game.id}
            onClick={() => handleCardClick(game.id)}
            disabled={selectedCard !== null}
            className={`
              w-full rounded-3xl overflow-hidden transform transition-all duration-300
              ${selectedCard === game.id ? 'scale-95 opacity-50' : 'hover:scale-[1.02] active:scale-98'}
              ${selectedCard !== null && selectedCard !== game.id ? 'opacity-30' : ''}
            `}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            <div className="relative h-48 overflow-hidden">
              {/* Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${game.gradient}`}
                style={{
                  boxShadow: `0 10px 40px ${game.glowColor}`,
                }}
              />

              {/* Decorative Pattern */}
              <div className="absolute inset-0 bg-black/10" />

              {/* Content */}
              <div className="relative h-full flex flex-col justify-between p-6">
                {/* Top Section */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">
                      {game.subtitle}
                    </p>
                    <h3 className="text-white text-2xl font-black tracking-tight mb-2">
                      {game.title}
                    </h3>
                    <p className="text-white/90 text-sm leading-relaxed">
                      {game.description}
                    </p>
                  </div>
                  <div className="text-6xl ml-4 opacity-90 drop-shadow-lg">
                    {game.icon}
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="flex items-center justify-between">
                  <div className="bg-black/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-white text-xs font-bold">
                    ИГРАТЬ
                  </div>
                  <div className="text-white/60 text-xs">
                    👥 Онлайн
                  </div>
                </div>
              </div>

              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-squid-dark via-squid-dark/90 to-transparent pt-8 pb-6 px-6">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>СЕРВЕР: ХАКАСИЯ-1</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            ОНЛАЙН
          </span>
        </div>
      </div>
    </div>
  );
};
