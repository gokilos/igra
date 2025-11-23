import React from 'react';

interface Player {
  id: string;
  name: string;
  avatar: React.JSX.Element;
  score?: number;
}

interface ModernGameHeaderProps {
  player1: Player;
  player2: Player;
  timer?: React.ReactNode;
  prize?: string;
  roundCount?: number;
  onBack: () => void;
  isPlayer1Turn?: boolean;
}

export const ModernGameHeader: React.FC<ModernGameHeaderProps> = ({
  player1,
  player2,
  timer,
  prize,
  roundCount,
  onBack,
  isPlayer1Turn,
}) => {
  return (
    <div className="sticky top-0 z-30 bg-gradient-to-b from-squid-dark to-squid-dark/95 backdrop-blur-sm border-b border-gray-800/50">
      {/* Top Bar */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-xl">←</span>
          <span className="text-xs font-bold">Выход</span>
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          {prize && (
            <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1">
              <span className="text-yellow-400">💰</span>
              <span className="text-yellow-400 font-bold">{prize}</span>
            </div>
          )}
          {roundCount !== undefined && (
            <div className="bg-squid-panel border border-gray-800 rounded-full px-3 py-1">
              <span className="font-mono">РАУНД {roundCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Players Info */}
      <div className="px-4 pb-3 flex items-center justify-between">
        {/* Player 1 */}
        <div className={`flex items-center gap-3 flex-1 ${isPlayer1Turn ? 'opacity-100' : 'opacity-50'}`}>
          <div className="relative">
            {player1.avatar}
            {isPlayer1Turn && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-squid-accent rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{player1.name}</p>
            {player1.score !== undefined && (
              <p className="text-squid-accent text-xs font-mono">{player1.score} очков</p>
            )}
          </div>
        </div>

        {/* Timer / VS */}
        <div className="px-4 flex-shrink-0">
          {timer || (
            <div className="text-gray-600 text-lg font-black">VS</div>
          )}
        </div>

        {/* Player 2 */}
        <div className={`flex items-center gap-3 flex-1 justify-end ${!isPlayer1Turn && isPlayer1Turn !== undefined ? 'opacity-100' : 'opacity-50'}`}>
          <div className="text-right">
            <p className="text-white font-bold text-sm">{player2.name}</p>
            {player2.score !== undefined && (
              <p className="text-squid-pink text-xs font-mono">{player2.score} очков</p>
            )}
          </div>
          <div className="relative">
            {player2.avatar}
            {!isPlayer1Turn && isPlayer1Turn !== undefined && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-squid-pink rounded-full animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
