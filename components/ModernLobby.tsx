import React from 'react';
import { Game } from '../services/supabase';
import { GameMode } from '../types';

interface ModernLobbyProps {
  currentPlayer: { id: string; login?: string | null; nickname?: string | null; avatar: string };
  onlinePlayers: Array<{ id: string; login?: string | null; nickname?: string | null; avatar: string }>;
  onlineCount: number;
  waitingGames: Game[];
  onCreateGame: () => void;
  onJoinGame: (game: Game) => void;
  onInvitePlayers: (game: Game) => void;
  onLogout: () => void;
  onBack: () => void;
  onEditNickname?: () => void;
  getPlayerAvatar: (player: any) => JSX.Element;
  selectedMode?: GameMode;
}

const getModeInfo = (mode: string) => {
  switch (mode) {
    case 'NUMBERS':
      return { icon: '🔢', name: 'Цифры', gradient: 'from-yellow-400 to-orange-500' };
    case 'WORDS':
      return { icon: '📝', name: 'Слова', gradient: 'from-blue-400 to-indigo-600' };
    case 'BATTLESHIP':
      return { icon: '🚢', name: 'Морской бой', gradient: 'from-cyan-400 to-green-500' };
    default:
      return { icon: '🎮', name: 'Игра', gradient: 'from-gray-400 to-gray-600' };
  }
};

export const ModernLobby: React.FC<ModernLobbyProps> = ({
  currentPlayer,
  onlinePlayers,
  onlineCount,
  waitingGames,
  onCreateGame,
  onJoinGame,
  onInvitePlayers,
  onLogout,
  onBack,
  onEditNickname,
  getPlayerAvatar,
  selectedMode,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-squid-dark via-[#0D1129] to-squid-dark relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-squid-accent/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-squid-blue/10 rounded-full blur-3xl animate-pulse animation-delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-6 pb-4 border-b border-gray-800/50 backdrop-blur-sm bg-squid-dark/50">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">Назад</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-squid-panel rounded-full px-4 py-2 border border-gray-800">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-gray-400">Онлайн:</span>
              <span className="text-sm font-bold text-white">{onlineCount}</span>
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-2 rounded-lg hover:bg-red-400/10 transition-all"
            >
              ВЫЙТИ
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          {getPlayerAvatar(currentPlayer)}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-lg">{currentPlayer.login || currentPlayer.nickname}</p>
              {onEditNickname && (
                <button
                  onClick={onEditNickname}
                  className="text-gray-400 hover:text-squid-accent transition-colors"
                  title="Изменить псевдоним"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-gray-400 text-xs">Игровое лобби{selectedMode && ` • ${getModeInfo(selectedMode).name}`}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 py-6 space-y-6">
        {/* Create Game Button */}
        <button
          onClick={onCreateGame}
          className="w-full bg-gradient-to-r from-squid-accent to-squid-yellow hover:from-squid-yellow hover:to-squid-accent text-squid-dark font-black py-4 px-6 rounded-2xl tracking-wider transform hover:scale-105 transition-all shadow-lg shadow-squid-accent/20"
        >
          <span className="text-lg">+ СОЗДАТЬ ИГРУ</span>
        </button>

        {/* Active Games */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Активные игры
            </h2>
            <span className="text-gray-600 text-xs">{waitingGames.length} игр</span>
          </div>

          {waitingGames.length === 0 ? (
            <div className="bg-squid-panel border border-gray-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🎮</div>
              <p className="text-gray-400 text-sm mb-1">Нет активных игр</p>
              <p className="text-gray-600 text-xs">Создайте первую!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingGames.map((game) => {
                const creator = onlinePlayers.find(p => p.id === game.creator_id);
                const isMyGame = game.creator_id === currentPlayer.id;
                const modeInfo = getModeInfo(game.game_mode);

                return (
                  <div
                    key={game.id}
                    className={`bg-squid-panel border rounded-2xl overflow-hidden transition-all hover:scale-[1.02] ${
                      isMyGame ? 'border-squid-accent shadow-lg shadow-squid-accent/20' : 'border-gray-800'
                    }`}
                  >
                    {/* Game Card Header */}
                    <div className={`bg-gradient-to-r ${modeInfo.gradient} p-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{modeInfo.icon}</div>
                        <div>
                          <h3 className="text-white font-black text-lg">
                            {game.game_name || `${modeInfo.name}`}
                          </h3>
                          <p className="text-white/80 text-xs">
                            от {creator?.login || creator?.nickname || 'Игрока'}
                          </p>
                        </div>
                      </div>
                      {isMyGame && (
                        <div className="bg-squid-accent text-squid-dark text-xs font-black px-3 py-1 rounded-full">
                          ВАША
                        </div>
                      )}
                    </div>

                    {/* Game Card Body */}
                    <div className="p-4">
                      {game.prize && (
                        <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🏆</span>
                            <div>
                              <p className="text-[10px] text-yellow-600 font-bold uppercase">Приз</p>
                              <p className="text-yellow-400 text-sm font-bold">{game.prize}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isMyGame ? (
                        <button
                          onClick={() => onJoinGame(game)}
                          className="w-full bg-gradient-to-r from-squid-green to-green-500 hover:from-green-500 hover:to-squid-green text-white font-black py-3 px-4 rounded-xl tracking-wider transition-all transform hover:scale-105"
                        >
                          ВСТУПИТЬ В ИГРУ
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-center text-xs text-gray-500 py-2 bg-gray-800/50 rounded-lg">
                            Ожидание оппонента...
                          </div>
                          <button
                            onClick={() => onInvitePlayers(game)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                          >
                            📨 ПРИГЛАСИТЬ ИГРОКОВ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Online Players */}
        <div className="space-y-3">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            Онлайн игроки
          </h3>
          <div className="bg-squid-panel border border-gray-800 rounded-2xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {onlinePlayers.slice(0, 12).map((player) => (
                <div
                  key={player.id}
                  className="bg-gray-800/50 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-gray-700/50 transition-colors"
                >
                  {getPlayerAvatar(player)}
                  <span className="text-gray-300 text-xs truncate flex-1">
                    {player.login || player.nickname}
                  </span>
                </div>
              ))}
            </div>
            {onlinePlayers.length > 12 && (
              <div className="text-xs text-gray-600 text-center mt-3">
                +{onlinePlayers.length - 12} еще
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 px-6 py-4 text-center text-xs text-gray-600 border-t border-gray-800/50 backdrop-blur-sm bg-squid-dark/50">
        СЕРВЕР: ХАКАСИЯ-1 • ПОДКЛЮЧЕНИЕ СТАБИЛЬНО
      </div>
    </div>
  );
};
