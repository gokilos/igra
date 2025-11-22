import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, GameStatus, AppScreen, Character } from './types';
import { generateAISecretNumber, generateAISecretWord } from './services/ai';
import Timer from './components/Timer';
import { Keyboard } from './components/Keyboard';
import { StartScreen } from './components/StartScreen';
import { CharacterSelection } from './components/CharacterSelection';
import { CHARACTERS } from './data/characters';
import {
  PlayerService,
  GameService,
  GuessService,
  Player,
  Game,
  Guess,
  startHeartbeat,
  supabase
} from './services/supabase';

// --- Constants ---
const NUM_LENGTH = 4;
const WORD_LENGTH = 5;
const TURN_DURATION = 120; // 120 seconds (2 minutes)

// --- Helper Components ---

const Modal = ({ children, onClose }: { children?: React.ReactNode, onClose?: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
    <div className="bg-squid-panel border-2 border-squid-pink p-6 max-w-md w-full shadow-[0_0_20px_rgba(255,0,122,0.3)] relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl font-bold"
        >
          ×
        </button>
      )}
      {children}
    </div>
  </div>
);

// --- Main App Component ---

const App: React.FC = () => {
  // Screen State
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.START);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  // Player State
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  // Login State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<'○' | '△' | '□'>('○');
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Game State
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOBBY);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.NONE);
  const [isCreator, setIsCreator] = useState(false);

  // Lobby State
  const [waitingGames, setWaitingGames] = useState<Game[]>([]);
  const [showCreateGameModal, setShowCreateGameModal] = useState(false);
  const [newGamePrize, setNewGamePrize] = useState('');
  const [newGameMode, setNewGameMode] = useState<GameMode>(GameMode.NUMBERS);

  // Gameplay State
  const [currentInput, setCurrentInput] = useState('');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [feedback, setFeedback] = useState<string>('ОЖИДАНИЕ...');
  const [mySecret, setMySecret] = useState('');
  const [opponentSecret, setOpponentSecret] = useState('');
  const [myRevealedIndices, setMyRevealedIndices] = useState<boolean[]>([]);
  const [opponentRevealedIndices, setOpponentRevealedIndices] = useState<boolean[]>([]);

  // Timer State
  const [timerResetKey, setTimerResetKey] = useState(0);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stopHeartbeatRef = useRef<(() => void) | null>(null);

  // --- Restore session from localStorage ---
  useEffect(() => {
    const restoreSession = async () => {
      const savedPlayerId = localStorage.getItem('squid_player_id');

      if (savedPlayerId) {
        // Try to get player from database
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', savedPlayerId)
          .single();

        if (data && !error) {
          // Update online status
          await PlayerService.updateOnlineStatus(data.id, true);
          setCurrentPlayer(data);
          setCurrentScreen(AppScreen.GAME);

          // Start heartbeat
          stopHeartbeatRef.current = startHeartbeat(data.id);
        } else {
          // Player not found, clear localStorage
          localStorage.removeItem('squid_player_id');
          setCurrentScreen(AppScreen.START);
        }
      } else {
        setCurrentScreen(AppScreen.START);
      }

      setIsLoadingSession(false);
    };

    restoreSession();
  }, []);

  // --- Save player to localStorage when set ---
  useEffect(() => {
    if (currentPlayer?.id) {
      localStorage.setItem('squid_player_id', currentPlayer.id);
    }
  }, [currentPlayer?.id]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (currentPlayer) {
        PlayerService.updateOnlineStatus(currentPlayer.id, false);
      }
      if (stopHeartbeatRef.current) {
        stopHeartbeatRef.current();
      }
    };
  }, [currentPlayer]);

  // --- Load Online Players and Count ---
  useEffect(() => {
    const loadOnlinePlayers = async () => {
      const players = await PlayerService.getOnlinePlayers();
      setOnlinePlayers(players.filter(p => p.id !== currentPlayer?.id));

      const count = await PlayerService.countOnlinePlayers();
      setOnlineCount(count);
    };

    if (currentPlayer) {
      loadOnlinePlayers();

      // Subscribe to player changes
      const channel = PlayerService.subscribeToOnlinePlayers(async (players) => {
        setOnlinePlayers(players.filter(p => p.id !== currentPlayer?.id));
        const count = await PlayerService.countOnlinePlayers();
        setOnlineCount(count);
      });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [currentPlayer]);

  // --- Load Waiting Games ---
  useEffect(() => {
    const loadWaitingGames = async () => {
      const games = await GameService.getWaitingGames();
      // Показываем ВСЕ игры в статусе WAITING (не фильтруем свои)
      setWaitingGames(games);
    };

    if (currentPlayer && status === GameStatus.LOBBY) {
      loadWaitingGames();

      // Subscribe to lobby games
      const channel = GameService.subscribeToLobbyGames((games) => {
        // Показываем ВСЕ игры в статусе WAITING
        setWaitingGames(games);
      });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [currentPlayer, status]);

  // --- Subscribe to Current Game ---
  useEffect(() => {
    if (currentGame?.id) {
      const channel = GameService.subscribeToGame(currentGame.id, async (game) => {
        console.log('Game update received:', game);
        setCurrentGame(game);

        // Check if both players are ready to start
        if (game.status === 'SETUP') {
          const ready = await GameService.checkBothPlayersReady(game.id);
          if (ready && game.creator_id === currentPlayer?.id) {
            // Creator starts the game
            await GameService.startGame(game.id, game.creator_id);
          }
        }

        // Update game status
        if (game.status === 'PLAYING') {
          if (status !== GameStatus.PLAYING) {
            setStatus(GameStatus.PLAYING);
          }

          // Update feedback and timer on turn change
          const isMyTurn = game.current_turn === currentPlayer?.id;
          setFeedback(isMyTurn ? 'ТВОЙ ХОД' : 'ХОД ОППОНЕНТА');
          setTimerResetKey(k => k + 1);
        }

        // Check for winner
        if (game.status === 'FINISHED') {
          setStatus(GameStatus.GAME_OVER);
        }

        // Update revealed indices and secrets
        const amCreator = game.creator_id === currentPlayer?.id;
        setMyRevealedIndices(amCreator ? game.creator_revealed_indices : game.opponent_revealed_indices);
        setOpponentRevealedIndices(amCreator ? game.opponent_revealed_indices : game.creator_revealed_indices);

        // Update secrets if they exist
        if (game.creator_secret && game.opponent_secret) {
          setMySecret(amCreator ? game.creator_secret : game.opponent_secret);
          setOpponentSecret(amCreator ? game.opponent_secret : game.creator_secret);
        }
      });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [currentGame?.id, currentPlayer?.id]);

  // --- Subscribe to Guesses ---
  useEffect(() => {
    if (currentGame?.id) {
      const loadGuesses = async () => {
        const gameGuesses = await GuessService.getGameGuesses(currentGame.id);
        console.log('Loaded guesses:', gameGuesses);
        setGuesses(gameGuesses);
      };

      loadGuesses();

      const channel = GuessService.subscribeToGuesses(currentGame.id, (guess) => {
        console.log('New guess received:', guess);
        setGuesses(prev => {
          // Избегаем дублирования
          if (prev.some(g => g.id === guess.id)) {
            return prev;
          }
          return [...prev, guess];
        });
      });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [currentGame?.id]);

  // Scroll history to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [guesses]);

  // --- Handlers ---

  const handleLoginSubmit = async () => {
    const trimmedLogin = loginInput.trim();

    // Валидация логина
    if (trimmedLogin.length < 3) {
      setLoginError('Логин должен быть минимум 3 символа');
      return;
    }

    if (trimmedLogin.length > 20) {
      setLoginError('Логин не должен превышать 20 символов');
      return;
    }

    if (!/^[а-яА-ЯёЁa-zA-Z0-9_-]+$/.test(trimmedLogin)) {
      setLoginError('Логин может содержать только буквы, цифры, _ и -');
      return;
    }

    // Проверить доступность логина
    const available = await PlayerService.isLoginAvailable(trimmedLogin);
    if (!available) {
      setLoginError('Этот логин уже занят');
      return;
    }

    // Создать игрока с ID персонажа в качестве аватара
    const avatarId = selectedCharacter?.id || 'player_067';
    const player = await PlayerService.createPlayer(trimmedLogin, avatarId as any);
    if (player) {
      setCurrentPlayer(player);
      setCurrentScreen(AppScreen.GAME);

      // Start heartbeat to keep player online
      stopHeartbeatRef.current = startHeartbeat(player.id);
    } else {
      setLoginError('Ошибка создания профиля. Попробуйте снова.');
    }
  };

  const handleCreateGame = async () => {
    if (!currentPlayer) return;

    const game = await GameService.createGame(currentPlayer.id, newGameMode, newGamePrize || undefined);
    if (game) {
      setCurrentGame(game);
      setGameMode(newGameMode);
      setIsCreator(true);
      setStatus(GameStatus.SETUP);
      setFeedback(newGameMode === GameMode.NUMBERS ? 'ЗАГАДАЙ 4 ЦИФРЫ' : 'ЗАГАДАЙ СЛОВО (5 БУКВ)');
      setShowCreateGameModal(false);
      setNewGamePrize('');

      const len = newGameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
      setMyRevealedIndices(Array(len).fill(false));
      setOpponentRevealedIndices(Array(len).fill(false));
    }
  };

  const handleJoinGame = async (game: Game) => {
    if (!currentPlayer) return;

    const joinedGame = await GameService.joinGame(game.id, currentPlayer.id);
    if (joinedGame) {
      setCurrentGame(joinedGame);
      setGameMode(joinedGame.game_mode as GameMode);
      setIsCreator(false);
      setStatus(GameStatus.SETUP);
      setFeedback(joinedGame.game_mode === 'NUMBERS' ? 'ЗАГАДАЙ 4 ЦИФРЫ' : 'ЗАГАДАЙ СЛОВО (5 БУКВ)');

      const len = joinedGame.game_mode === 'NUMBERS' ? NUM_LENGTH : WORD_LENGTH;
      setMyRevealedIndices(Array(len).fill(false));
      setOpponentRevealedIndices(Array(len).fill(false));
    }
  };

  const handleSetupSubmit = async () => {
    if (!currentPlayer || !currentGame || isSubmitting) return;

    const len = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
    if (currentInput.length !== len) return;

    setIsSubmitting(true);
    try {
      setMySecret(currentInput);
      await GameService.setPlayerSecret(currentGame.id, currentPlayer.id, currentInput, isCreator);

      setFeedback('ОЖИДАНИЕ ОППОНЕНТА...');
      setCurrentInput('');

      // Check if both players are ready
      const ready = await GameService.checkBothPlayersReady(currentGame.id);
      if (ready && isCreator) {
        // Creator starts the game
        await GameService.startGame(currentGame.id, currentPlayer.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitGuess = async () => {
    if (!currentPlayer || !currentGame || isSubmitting) return;

    const len = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
    if (currentInput.length !== len) return;
    if (currentGame.current_turn !== currentPlayer.id) return;

    console.log('Submitting guess:', currentInput);

    setIsSubmitting(true);
    try {
      // Get opponent's secret
      const game = await GameService.getGame(currentGame.id);
      if (!game) return;

      const targetSecret = isCreator ? game.opponent_secret : game.creator_secret;
      if (!targetSecret) return;

      const guess = currentInput;
      let matchCount = 0;
      const isWin = guess === targetSecret;
      let newRevealed = isCreator ? [...game.opponent_revealed_indices] : [...game.creator_revealed_indices];
      const oldRevealed = [...newRevealed]; // Сохраняем старое состояние для подсчета НОВЫХ совпадений

      if (isWin) {
        newRevealed = newRevealed.map(() => true);
      } else {
        for (let i = 0; i < targetSecret.length; i++) {
          if (guess[i] === targetSecret[i]) {
            // Считаем только если это НОВОЕ совпадение (не было угадано ранее)
            if (!oldRevealed[i]) {
              matchCount++;
            }
            newRevealed[i] = true;
          }
        }
      }

      console.log('Match count (NEW matches only):', matchCount, 'Is win:', isWin);

      // Update revealed indices
      await GameService.updateRevealedIndices(currentGame.id, currentPlayer.id, newRevealed, !isCreator);

      // Add guess to history
      const resultText = isWin ? 'ВЕРНО!' : (matchCount > 0 ? `ОТКРЫТО: ${matchCount}` : 'НЕТ СОВПАДЕНИЙ');
      const guessResult = await GuessService.addGuess(currentGame.id, currentPlayer.id, guess, resultText, matchCount);
      console.log('Guess added to DB:', guessResult);

      if (isWin) {
        console.log('Game won! Finishing game...');
        await GameService.finishGame(currentGame.id, currentPlayer.id);
      } else {
        // Switch turn
        const nextPlayer = isCreator ? game.opponent_id : game.creator_id;
        if (nextPlayer) {
          console.log('Switching turn to:', nextPlayer);
          await GameService.switchTurn(currentGame.id, nextPlayer);
        }
      }

      setCurrentInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInput = (char: string) => {
    const maxLen = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
    if (currentInput.length < maxLen) {
      setCurrentInput(prev => prev + char);
    }
  };

  const handleDelete = () => {
    setCurrentInput(prev => prev.slice(0, -1));
  };

  const handleTimeUp = useCallback(async () => {
    if (status !== GameStatus.PLAYING || !currentGame || !currentPlayer) return;

    setFeedback('ВРЕМЯ ИСТЕКЛО. ХОД ПЕРЕХОДИТ.');

    // Switch turn
    const game = await GameService.getGame(currentGame.id);
    if (game) {
      const nextPlayer = isCreator ? game.opponent_id : game.creator_id;
      if (nextPlayer) {
        await GameService.switchTurn(currentGame.id, nextPlayer);
      }
    }
    setTimerResetKey(k => k + 1);
  }, [status, currentGame, currentPlayer, isCreator]);

  const handleBackToLobby = () => {
    setStatus(GameStatus.LOBBY);
    setCurrentGame(null);
    setGameMode(GameMode.NONE);
    setIsCreator(false);
    setCurrentInput('');
    setGuesses([]);
    setMySecret('');
    setOpponentSecret('');
    setMyRevealedIndices([]);
    setOpponentRevealedIndices([]);
  };

  const handleLogout = () => {
    if (currentPlayer) {
      PlayerService.updateOnlineStatus(currentPlayer.id, false);
    }
    if (stopHeartbeatRef.current) {
      stopHeartbeatRef.current();
    }
    localStorage.removeItem('squid_player_id');
    setCurrentPlayer(null);
    setCurrentScreen(AppScreen.START);
    setStatus(GameStatus.LOBBY);
    setCurrentGame(null);
    setSelectedCharacter(null);
  };

  const handleStartGame = () => {
    setCurrentScreen(AppScreen.CHARACTER_SELECT);
  };

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
    setCurrentScreen(AppScreen.LOGIN);
  };

  // --- Render Helpers ---

  const getCharacterById = (characterId: string): Character | null => {
    return CHARACTERS.find(c => c.id === characterId) || null;
  };

  const getPlayerAvatar = (player: Player): JSX.Element => {
    const character = getCharacterById(player.avatar);
    if (character?.avatarPath) {
      return (
        <img
          src={character.avatarPath}
          alt={player.login || player.nickname}
          className="w-8 h-8 rounded-full object-cover border-2 border-squid-pink"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            if (target.nextElementSibling) {
              (target.nextElementSibling as HTMLElement).style.display = 'flex';
            }
          }}
        />
      );
    }
    return <span className="text-xl">{player.avatar}</span>;
  };

  const getOpponentNickname = (): string => {
    if (!currentGame) return '???';
    const opponentId = isCreator ? currentGame.opponent_id : currentGame.creator_id;
    const opponent = onlinePlayers.find(p => p.id === opponentId);
    return opponent?.login || opponent?.nickname || '???';
  };

  const getOpponentAvatar = (): JSX.Element => {
    if (!currentGame) return <span>?</span>;
    const opponentId = isCreator ? currentGame.opponent_id : currentGame.creator_id;
    const opponent = onlinePlayers.find(p => p.id === opponentId);
    if (!opponent) return <span>?</span>;
    return getPlayerAvatar(opponent);
  };

  const renderSecretDisplay = (isMine: boolean) => {
    const secret = isMine ? mySecret : opponentSecret;
    const revealed = isMine ? myRevealedIndices : opponentRevealedIndices;
    const length = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;

    // During setup, show current input
    if (status === GameStatus.SETUP && isMine) {
      return (
        <div className="flex gap-2 justify-center mb-6">
          {Array.from({ length }).map((_, i) => (
            <div key={i} className="w-10 h-14 sm:w-12 sm:h-16 border-2 border-squid-pink bg-squid-panel flex items-center justify-center text-xl sm:text-2xl font-mono text-squid-pink shadow-[0_0_10px_rgba(255,0,122,0.5)]">
              {currentInput[i] || ''}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center mb-4">
        <div className="text-xs text-gray-400 mb-1 flex items-center gap-2 uppercase">
          {isMine ? (
            <span className="text-squid-green">ВЫ ({currentPlayer?.login || currentPlayer?.nickname})</span>
          ) : (
            <span className="text-squid-pink">{getOpponentNickname()}</span>
          )}
          {currentGame?.current_turn === (isMine ? currentPlayer?.id : (isCreator ? currentGame?.opponent_id : currentGame?.creator_id)) && status === GameStatus.PLAYING && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping"/>
          )}
        </div>
        <div className="flex gap-1 sm:gap-2">
          {Array.from({ length }).map((_, i) => {
            const char = secret?.[i] || '*';
            const isRevealed = revealed[i];
            const showChar = isRevealed || (isMine && status !== GameStatus.GAME_OVER);

            return (
              <div key={i} className={`
                w-8 h-12 sm:w-12 sm:h-16 border-2 flex items-center justify-center text-lg sm:text-2xl font-mono transition-all duration-300
                ${isMine ? 'border-squid-green text-squid-green' : 'border-squid-pink text-squid-pink'}
                ${isRevealed ? 'bg-gray-800' : 'bg-squid-panel'}
              `}>
                {showChar ? char : '*'}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLobby = () => (
    <div className="flex flex-col h-screen p-4 animate-fadeIn bg-squid-dark">
      <div className="text-center space-y-2 mb-4">
        <h1 className="text-3xl font-black tracking-widest text-white">
          ИГРА В<br/><span className="text-squid-pink">КАЛЬМАРА</span>
        </h1>
        <div className="flex items-center justify-center gap-2">
          <p className="text-squid-green font-mono text-xs tracking-widest">
            ВАШ ID: {currentPlayer?.login || currentPlayer?.nickname}
          </p>
          {currentPlayer && getPlayerAvatar(currentPlayer)}
        </div>
        <div className="text-yellow-400 font-mono text-sm">
          ОНЛАЙН: {onlineCount} игроков
        </div>
      </div>

      {/* Create Game Button */}
      <button
        onClick={() => setShowCreateGameModal(true)}
        className="w-full bg-squid-pink hover:bg-pink-700 text-white font-bold py-3 px-4 rounded mb-4 tracking-wider"
      >
        + СОЗДАТЬ СВОЮ ИГРУ
      </button>

      {/* Waiting Games */}
      <div className="overflow-y-auto bg-gray-900/50 border border-gray-800 rounded p-3 mb-4" style={{ minHeight: '400px', maxHeight: '60vh' }}>
        <h2 className="text-xs font-mono text-gray-500 mb-3 border-b border-gray-700 pb-2">
          АКТИВНЫЕ ИГРЫ ({waitingGames.length})
        </h2>
        <div className="space-y-3">
          {waitingGames.length === 0 ? (
            <div className="text-center text-gray-600 py-8 text-sm">
              НЕТ АКТИВНЫХ ИГР<br/>
              <span className="text-xs">СОЗДАЙ ПЕРВУЮ!</span>
            </div>
          ) : (
            waitingGames.map((game) => {
              const creator = onlinePlayers.find(p => p.id === game.creator_id);
              const isMyGame = game.creator_id === currentPlayer?.id;

              return (
                <div key={game.id} className={`bg-squid-panel border p-3 rounded ${isMyGame ? 'border-squid-green' : 'border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10">
                        {creator ? getPlayerAvatar(creator) : <span>?</span>}
                      </div>
                      <div>
                        <div className="text-white text-sm font-bold">
                          {creator?.login || creator?.nickname || 'Игрок'}
                          {isMyGame && <span className="text-squid-green text-xs ml-2">(ваша игра)</span>}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {game.game_mode === 'NUMBERS' ? '🔢 ЦИФРЫ' : '📝 СЛОВА'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {game.prize && (
                    <div className="bg-yellow-900/30 border border-yellow-600/50 rounded px-2 py-1 mb-2">
                      <div className="text-[9px] text-yellow-600 font-bold">🏆 ПРИЗ:</div>
                      <div className="text-xs text-yellow-400">{game.prize}</div>
                    </div>
                  )}
                  {!isMyGame ? (
                    <button
                      onClick={() => handleJoinGame(game)}
                      className="w-full bg-squid-green hover:bg-green-700 text-black text-sm px-3 py-2 rounded font-bold tracking-wider"
                    >
                      ВСТУПИТЬ В ИГРУ
                    </button>
                  ) : (
                    <div className="text-center text-xs text-gray-500 py-2">
                      Ожидание оппонента...
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Online Players - показываем рядом */}
      <div className="bg-gray-900/30 border border-gray-800 rounded p-3 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono text-gray-500">ОНЛАЙН ИГРОКИ</h3>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 font-mono"
          >
            ВЫЙТИ
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {onlinePlayers.slice(0, 12).map((player) => (
            <div key={player.id} className="text-xs bg-gray-800/50 rounded px-2 py-1 flex items-center gap-2">
              {getPlayerAvatar(player)}
              <span className="text-gray-400 truncate">{player.login || player.nickname}</span>
            </div>
          ))}
        </div>
        {onlinePlayers.length > 12 && (
          <div className="text-xs text-gray-600 text-center mt-2">
            +{onlinePlayers.length - 12} еще
          </div>
        )}
        </div>

      <div className="text-center text-gray-600 text-[10px] font-mono mt-2">
        СЕРВЕР: ХАКАСИЯ-1 • ПОДКЛЮЧЕНИЕ СТАБИЛЬНО
      </div>
      

      {/* Create Game Modal */}
      {showCreateGameModal && (
        <Modal onClose={() => setShowCreateGameModal(false)}>
          <h2 className="text-2xl font-black text-squid-pink mb-4">СОЗДАТЬ ИГРУ</h2>

          <div className="space-y-4 text-left">
            <div>
              <label className="text-xs text-gray-400 uppercase block mb-2">Режим игры:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewGameMode(GameMode.NUMBERS)}
                  className={`flex-1 py-2 px-4 rounded font-bold ${newGameMode === GameMode.NUMBERS ? 'bg-squid-pink text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  ЦИФРЫ
                </button>
                <button
                  onClick={() => setNewGameMode(GameMode.WORDS)}
                  className={`flex-1 py-2 px-4 rounded font-bold ${newGameMode === GameMode.WORDS ? 'bg-squid-green text-black' : 'bg-gray-800 text-gray-400'}`}
                >
                  СЛОВА
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase block mb-2">Приз (опционально):</label>
              <input
                type="text"
                value={newGamePrize}
                onChange={(e) => setNewGamePrize(e.target.value)}
                placeholder="Например: 1000₽ или Кофе"
                maxLength={50}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-squid-pink"
              />
            </div>

            <button
              onClick={handleCreateGame}
              className="w-full bg-squid-pink hover:bg-pink-700 text-white font-bold py-3 px-4 rounded tracking-wider"
            >
              СОЗДАТЬ
            </button>
          </div>
        </Modal>
      )}
    </div>
  );

  const renderGame = () => {
    // Helper function to render guess with colored squares
    const renderGuessSquares = (guess: Guess, targetSecret: string) => {
      const guessChars = guess.guess.split('');
      const secretChars = targetSecret.split('');

      return (
        <div className="flex gap-1 justify-center">
          {guessChars.map((char, idx) => {
            const isMatch = char === secretChars[idx];
            return (
              <div
                key={idx}
                className={`w-6 h-6 sm:w-8 sm:h-8 border-2 flex items-center justify-center text-xs sm:text-sm font-bold rounded transition-all ${
                  isMatch
                    ? 'bg-squid-green/30 border-squid-green text-squid-green'
                    : 'bg-gray-800 border-gray-600 text-gray-400'
                }`}
              >
                {char}
              </div>
            );
          })}
        </div>
      );
    };

    const mySecret = isCreator ? currentGame?.creator_secret : currentGame?.opponent_secret;
    const opponentSecretValue = isCreator ? currentGame?.opponent_secret : currentGame?.creator_secret;

    return (
      <div className="h-screen flex flex-col mx-auto relative max-w-2xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-squid-dark px-4 pt-3 pb-2 border-b border-gray-800">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              {getOpponentAvatar()}
              <span className="text-sm text-gray-400">{getOpponentNickname()}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Мое загаданное слово/цифры - мелким шрифтом */}
              {status !== GameStatus.SETUP && mySecret && (
                <div className="text-[10px] text-gray-500 font-mono">
                  МОЕ: <span className="text-squid-green">{mySecret}</span>
                </div>
              )}
              <div className="font-mono text-xs text-gray-400">
                {currentGame?.prize && <span className="text-yellow-400 mr-2">💰 {currentGame.prize}</span>}
                РАУНД {currentGame?.turn_count || 0}
              </div>
              <button onClick={handleBackToLobby} className="text-xs text-red-500 font-bold hover:underline uppercase">
                Выход
              </button>
            </div>
          </div>
        </div>

        {/* Info Banner + Opponent Secret - Sticky */}
        <div className="sticky top-[57px] z-20 bg-squid-dark px-4 pb-2">
          <div className="bg-squid-panel border-l-4 border-squid-pink p-2 mb-2 font-mono text-sm text-center shadow-lg text-white">
            {feedback}
          </div>

          {/* Opponent's Secret - только блок оппонента */}
          {status !== GameStatus.SETUP && (
            <div className="mb-2">
              {renderSecretDisplay(false)}
            </div>
          )}

          {/* My Secret Display - только для SETUP режима */}
          {status === GameStatus.SETUP && (
            <div className="mb-2">
              {renderSecretDisplay(true)}
            </div>
          )}
        </div>

        {/* History - scrollable area */}
        <div className="flex-1 px-4 pb-2 overflow-hidden">
          <div className="h-full overflow-y-auto" ref={scrollRef}>
          <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">
            📊 История отгадываний
          </h3>
          {guesses.length === 0 ? (
            <div className="text-center text-gray-600 text-xs py-6">
              История пуста<br/>Начните угадывать!
            </div>
          ) : (
            <div className="space-y-2">
              {guesses.map((guess, idx) => {
                const isMine = guess.player_id === currentPlayer?.id;
                const targetSecret = isMine ? (opponentSecretValue || '') : (mySecret || '');

                return (
                  <div key={guess.id || idx} className="bg-gray-800/50 rounded p-2 border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isMine ? 'text-squid-green' : 'text-squid-pink'}`}>
                        {isMine ? `ВЫ (${currentPlayer?.login})` : getOpponentNickname()}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        #{idx + 1}
                      </span>
                    </div>
                    {renderGuessSquares(guess, targetSecret)}
                    <div className="text-[10px] text-center mt-1 font-mono text-gray-400">
                      {guess.result}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Controls Area - Fixed at bottom */}
        <div className="sticky bottom-0 z-20 bg-squid-dark px-4 pt-3 pb-4 border-t border-gray-800">
          {status === GameStatus.PLAYING && (
            <Timer
              duration={TURN_DURATION}
              onTimeUp={handleTimeUp}
              isActive={true}
              resetKey={timerResetKey}
            />
          )}

          {/* Input Display */}
          {((status === GameStatus.PLAYING && currentGame?.current_turn === currentPlayer?.id) || status === GameStatus.SETUP) && (
            <div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH }).map((_, i) => (
                <div key={i} className="w-10 h-12 border-b-2 border-white flex items-center justify-center text-xl font-mono text-white">
                  {currentInput[i] || ''}
                </div>
              ))}
            </div>
          )}

          {/* Full-width keyboard */}
          <div className="w-full">
            <Keyboard
              mode={gameMode === GameMode.NUMBERS ? 'NUMERIC' : 'ALPHA'}
              onInput={handleInput}
              onDelete={handleDelete}
              onSubmit={status === GameStatus.SETUP ? handleSetupSubmit : handleSubmitGuess}
              disabled={(status === GameStatus.PLAYING && currentGame?.current_turn !== currentPlayer?.id) || isSubmitting}
              loading={isSubmitting}
              usedKeys={[]}
            />
          </div>
        </div>

        {/* Game Over Modal */}
        {status === GameStatus.GAME_OVER && currentGame && (
          <Modal>
            <div className="text-center space-y-6">
              <h2 className={`text-3xl font-black ${currentGame.winner_id === currentPlayer?.id ? 'text-squid-green' : 'text-squid-pink'}`}>
                {currentGame.winner_id === currentPlayer?.id ? 'ПОБЕДА' : 'ВЫБЫЛ'}
              </h2>
              <p className="font-mono text-sm text-gray-300">
                {currentGame.winner_id === currentPlayer?.id
                  ? 'ВЫ РАЗГАДАЛИ КОД!'
                  : 'ОППОНЕНТ ОКАЗАЛСЯ БЫСТРЕЕ.'}
              </p>
              {currentGame.prize && currentGame.winner_id === currentPlayer?.id && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-600 rounded">
                  <p className="text-yellow-400 font-bold text-lg">🏆 ВЫ ВЫИГРАЛИ</p>
                  <p className="text-yellow-300 text-xl mt-2">{currentGame.prize}</p>
                </div>
              )}
              <div className="p-4 bg-black/50 rounded border border-gray-700">
                <p className="text-xs text-gray-500 mb-1">СЕКРЕТ {getOpponentNickname()}</p>
                <p className="text-xl tracking-widest text-squid-pink">
                  {isCreator ? currentGame.opponent_secret : currentGame.creator_secret}
                </p>
              </div>
              <button
                onClick={handleBackToLobby}
                className="w-full py-3 bg-white text-black font-bold hover:bg-gray-200 transition-colors rounded"
              >
                ВЕРНУТЬСЯ В МЕНЮ
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Loading Screen
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-squid-dark flex items-center justify-center">
        <div className="text-white text-xl font-mono animate-pulse">ЗАГРУЗКА...</div>
      </div>
    );
  }

  // Start Screen
  if (currentScreen === AppScreen.START) {
    return <StartScreen onStart={handleStartGame} />;
  }

  // Character Selection Screen
  if (currentScreen === AppScreen.CHARACTER_SELECT) {
    return <CharacterSelection characters={CHARACTERS} onSelect={handleCharacterSelect} />;
  }

  // Login Screen
  if (currentScreen === AppScreen.LOGIN) {
    return (
      <div className="min-h-screen bg-squid-dark flex items-center justify-center p-4">
        <Modal onClose={() => setCurrentScreen(AppScreen.CHARACTER_SELECT)}>
          <h1 className="text-3xl font-black text-center mb-2">
            ИГРА В<br/><span className="text-squid-pink">КАЛЬМАРА</span>
          </h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Введите ваш логин для {selectedCharacter?.name}
          </p>

          {/* Character Preview */}
          {selectedCharacter && (
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-800/50 rounded border border-squid-pink/30">
              <div className="w-16 h-16 rounded-full bg-gradient-to-b from-teal-500/30 to-green-500/30 flex items-center justify-center">
                <img
                  src={selectedCharacter.avatarPath || selectedCharacter.imagePath}
                  alt={selectedCharacter.name}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <p className="text-squid-green font-bold">{selectedCharacter.name}</p>
                <p className="text-xs text-gray-400">Выбранный персонаж</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Login Input */}
            <div>
              <label className="text-xs text-gray-400 uppercase block mb-2">
                Ваш логин:
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value);
                  setLoginError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLoginSubmit();
                  }
                }}
                placeholder="Введите логин"
                maxLength={20}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-squid-pink"
                autoFocus
              />
              {loginError && (
                <p className="text-red-500 text-xs mt-1">{loginError}</p>
              )}
              <p className="text-gray-600 text-xs mt-1">
                3-20 символов, только буквы, цифры, _ и -
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleLoginSubmit}
              disabled={loginInput.trim().length < 3}
              className="w-full bg-squid-pink hover:bg-pink-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded tracking-wider transition-colors"
            >
              ВОЙТИ В ИГРУ
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // Game Screen (Lobby or Playing)
  return (
    <div className="bg-squid-dark min-h-screen text-white overflow-hidden font-sans">
      {currentPlayer && (status === GameStatus.LOBBY ? renderLobby() : renderGame())}
    </div>
  );
};

export default App;
