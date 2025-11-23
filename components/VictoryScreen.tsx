import React from 'react';

interface VictoryScreenProps {
  isWinner: boolean;
  playerName: string;
  opponentName: string;
  prize?: string;
  secretRevealed?: string;
  onBackToMenu: () => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  isWinner,
  playerName,
  opponentName,
  prize,
  secretRevealed,
  onBackToMenu,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-fadeIn">
      <div className="max-w-md w-full space-y-6 text-center">
        {/* Trophy / Icon */}
        <div className="relative">
          {isWinner ? (
            <div className="mx-auto w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 bg-squid-accent rounded-full blur-3xl opacity-50 animate-pulse"></div>
              <div className="relative text-8xl animate-bounce">🏆</div>
            </div>
          ) : (
            <div className="mx-auto w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 bg-red-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <div className="relative text-8xl">😢</div>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <h1 className={`text-5xl font-black tracking-tight mb-2 ${
            isWinner
              ? 'bg-gradient-to-r from-squid-accent via-squid-yellow to-squid-accent bg-clip-text text-transparent'
              : 'text-red-500'
          }`}>
            {isWinner ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
          </h1>
          <p className="text-gray-400 text-lg">
            {isWinner
              ? `Вы обыграли ${opponentName}`
              : `${opponentName} оказался быстрее`
            }
          </p>
        </div>

        {/* Prize */}
        {isWinner && prize && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-2xl p-6">
            <p className="text-yellow-400 font-bold text-sm uppercase tracking-wider mb-2">
              🏆 Вы выиграли
            </p>
            <p className="text-yellow-300 text-3xl font-black">
              {prize}
            </p>
          </div>
        )}

        {/* Secret Revealed */}
        {secretRevealed && (
          <div className="bg-squid-panel border-2 border-gray-800 rounded-2xl p-6">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">
              Секрет {isWinner ? opponentName : 'оппонента'}
            </p>
            <div className="flex gap-2 justify-center">
              {secretRevealed.split('').map((char, idx) => (
                <div
                  key={idx}
                  className="w-12 h-16 bg-gradient-to-br from-squid-accent/20 to-squid-yellow/20 border-2 border-squid-accent/50 rounded-lg flex items-center justify-center text-2xl font-black text-squid-accent"
                >
                  {char}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-squid-panel border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Ваш счет</p>
            <p className="text-white text-2xl font-black">{playerName}</p>
          </div>
          <div className="bg-squid-panel border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Оппонент</p>
            <p className="text-white text-2xl font-black">{opponentName}</p>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={onBackToMenu}
          className="w-full bg-gradient-to-r from-squid-accent to-squid-yellow hover:from-squid-yellow hover:to-squid-accent text-squid-dark font-black py-4 px-6 rounded-2xl tracking-wider transform hover:scale-105 transition-all shadow-lg shadow-squid-accent/30"
        >
          ВЕРНУТЬСЯ В МЕНЮ
        </button>

        {/* Decorative Elements */}
        {isWinner && (
          <>
            <div className="absolute top-10 left-10 text-4xl animate-bounce animation-delay-300">🎉</div>
            <div className="absolute top-20 right-20 text-4xl animate-bounce animation-delay-500">⭐</div>
            <div className="absolute bottom-20 left-20 text-4xl animate-bounce animation-delay-700">🎊</div>
            <div className="absolute bottom-10 right-10 text-4xl animate-bounce animation-delay-900">✨</div>
          </>
        )}
      </div>
    </div>
  );
};
