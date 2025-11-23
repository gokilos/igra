import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, GameStatus, AppScreen, Character, Ship, ShipType, BattleshipHit } from './types';
import { generateAISecretNumber, generateAISecretWord } from './services/ai';
import Timer from './components/Timer';
import { Keyboard } from './components/Keyboard';
import { StartScreen } from './components/StartScreen';
import { CharacterSelection } from './components/CharacterSelection';
import { BattleshipGrid } from './components/BattleshipGrid';
import { ShipPlacer } from './components/ShipPlacer';
import { CHARACTERS } from './data/characters';
import { haptic } from './utils/haptic';
import {
  PlayerService,
  GameService,
  GuessService,
  InvitationService,
  Player,
  Game,
  Guess,
  Invitation,
  startHeartbeat,
  supabase
} from './services/supabase';
import {
  createEmptyShips,
  placeShip,
  generateRandomShips,
  checkHit,
  updateShipsAfterHit,
  checkWin,
  areAllShipsPlaced,
  isValidPlacement
} from './utils/battleship';

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
  const [newGameName, setNewGameName] = useState('');
  const [newGameMode, setNewGameMode] = useState<GameMode>(GameMode.NUMBERS);
  const [newWordLength, setNewWordLength] = useState<number>(5);
  const [gameFilter, setGameFilter] = useState<'all' | 'active' | 'mine'>('active');
  const [hiddenGames, setHiddenGames] = useState<Set<string>>(new Set());

  // Invitation State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');

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

  // Battleship State
  const [myShips, setMyShips] = useState<Ship[]>([]);
  const [opponentShips, setOpponentShips] = useState<Ship[]>([]);
  const [myHits, setMyHits] = useState<BattleshipHit[]>([]);
  const [opponentHits, setOpponentHits] = useState<BattleshipHit[]>([]);
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);
  const [shipOrientation, setShipOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [highlightCells, setHighlightCells] = useState<[number, number][]>([]);
  const [highlightValid, setHighlightValid] = useState(true);

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

        const amCreator = game.creator_id === currentPlayer?.id;

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
          const wasMyTurn = currentGame?.current_turn === currentPlayer?.id;

          // Виброотклик при смене хода на меня
          if (isMyTurn && !wasMyTurn) {
            haptic.medium();
          }

          // Виброотклик успеха когда оппонент завершил свой ход
          if (!isMyTurn && wasMyTurn) {
            haptic.success();
          }

          setFeedback(isMyTurn ? 'ТВОЙ ХОД' : 'ХОД ОППОНЕНТА');
          setTimerResetKey(k => k + 1);
        }

        // Check for winner
        if (game.status === 'FINISHED') {
          setStatus(GameStatus.GAME_OVER);

          // Виброотклик при окончании игры (успех если победил, ошибка если проиграл)
          if (game.winner_id === currentPlayer?.id) {
            haptic.success();
          } else {
            haptic.error();
          }
        }

        // Update data for Battleship mode
        if (game.game_mode === 'BATTLESHIP') {
          // Обновляем свои корабли
          const myShipsData = amCreator ? game.creator_ships : game.opponent_ships;
          if (myShipsData) {
            setMyShips(myShipsData);
          }

          // Обновляем корабли оппонента
          const oppShipsData = amCreator ? game.opponent_ships : game.creator_ships;
          if (oppShipsData) {
            setOpponentShips(oppShipsData);
          }

          // Обновляем выстрелы
          const myHitsData = amCreator ? game.creator_hits : game.opponent_hits;
          const oppHitsData = amCreator ? game.opponent_hits : game.creator_hits;
          if (myHitsData) setMyHits(myHitsData);
          if (oppHitsData) setOpponentHits(oppHitsData);
        } else {
          // Update revealed indices and secrets for NUMBERS/WORDS
          setMyRevealedIndices(amCreator ? game.creator_revealed_indices : game.opponent_revealed_indices);
          setOpponentRevealedIndices(amCreator ? game.opponent_revealed_indices : game.creator_revealed_indices);

          // Update secrets if they exist
          if (game.creator_secret && game.opponent_secret) {
            setMySecret(amCreator ? game.creator_secret : game.opponent_secret);
            setOpponentSecret(amCreator ? game.opponent_secret : game.creator_secret);
          }
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

        // Виброотклик при получении хода от оппонента
        if (guess.player_id !== currentPlayer?.id) {
          haptic.medium(); // Средняя вибрация для уведомления о ходе оппонента
        }

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

  // Scroll history to bottom when guesses update or when it's my turn
  useEffect(() => {
    if (scrollRef.current) {
      // Прокручиваем плавно вниз
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [guesses, currentGame?.current_turn]);

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

    // Создать игрока с валидным аватаром (○, △, □), чтобы пройти CHECK-constraint
    const player = await PlayerService.createPlayer(trimmedLogin, selectedAvatar);
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

    const game = await GameService.createGame(
      currentPlayer.id,
      newGameMode,
      newGamePrize || undefined,
      newGameName || undefined,
      newGameMode === GameMode.WORDS ? newWordLength : undefined
    );

    if (game) {
      setCurrentGame(game);
      setGameMode(newGameMode);
      setIsCreator(true);
      setStatus(GameStatus.SETUP);

      // Инициализация для разных режимов
      if (newGameMode === GameMode.BATTLESHIP) {
        setFeedback('РАССТАВЬ СВОИ КОРАБЛИ');
        setMyShips(createEmptyShips());
        setOpponentShips([]);
        setMyHits([]);
        setOpponentHits([]);
        setSelectedShip(null);
        setShipOrientation('horizontal');
      } else {
        const wordLen = game.word_length || newWordLength;
        setFeedback(newGameMode === GameMode.NUMBERS ? 'ЗАГАДАЙ 4 ЦИФРЫ' : `ЗАГАДАЙ СЛОВО (${wordLen} БУКВ)`);
        const len = newGameMode === GameMode.NUMBERS ? NUM_LENGTH : wordLen;
        setMyRevealedIndices(Array(len).fill(false));
        setOpponentRevealedIndices(Array(len).fill(false));
      }

      setShowCreateGameModal(false);
      setNewGamePrize('');
      setNewGameName('');

      // Виброотклик успеха при создании игры
      haptic.success();
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

      // Инициализация для разных режимов
      if (joinedGame.game_mode === 'BATTLESHIP') {
        setFeedback('РАССТАВЬ СВОИ КОРАБЛИ');
        setMyShips(createEmptyShips());
        setOpponentShips([]);
        setMyHits([]);
        setOpponentHits([]);
        setSelectedShip(null);
        setShipOrientation('horizontal');
      } else {
        const wordLen = joinedGame.word_length || 5;
        setFeedback(joinedGame.game_mode === 'NUMBERS' ? 'ЗАГАДАЙ 4 ЦИФРЫ' : `ЗАГАДАЙ СЛОВО (${wordLen} БУКВ)`);
        const len = joinedGame.game_mode === 'NUMBERS' ? NUM_LENGTH : wordLen;
        setMyRevealedIndices(Array(len).fill(false));
        setOpponentRevealedIndices(Array(len).fill(false));
      }

      // Виброотклик успеха при присоединении к игре
      haptic.success();
    }
  };

  const handleSetupSubmit = async () => {
    if (!currentPlayer || !currentGame || isSubmitting) return;

    const len = gameMode === GameMode.NUMBERS ? NUM_LENGTH : (currentGame.word_length || 5);
    if (currentInput.length !== len) return;

    setIsSubmitting(true);
    try {
      setMySecret(currentInput);
      await GameService.setPlayerSecret(currentGame.id, currentPlayer.id, currentInput, isCreator);

      // Виброотклик успеха при установке секрета
      haptic.success();

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

    const len = gameMode === GameMode.NUMBERS ? NUM_LENGTH : (currentGame.word_length || 5);
    if (currentInput.length !== len) return;
    if (currentGame.current_turn !== currentPlayer.id) return;

    console.log('Submitting guess:', currentInput);

    // Легкая вибрация при отправке попытки
    haptic.light();

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

      // Виброотклик в зависимости от результата
      if (isWin || matchCount > 0) {
        haptic.success();
      }

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
    const maxLen = gameMode === GameMode.NUMBERS ? NUM_LENGTH : (currentGame?.word_length || 5);
    if (currentInput.length < maxLen) {
      haptic.selection();
      setCurrentInput(prev => prev + char);
    }
  };

  const handleDelete = () => {
    if (currentInput.length > 0) {
      haptic.selection();
    }
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
    setMyShips([]);
    setOpponentShips([]);
    setMyHits([]);
    setOpponentHits([]);
    setSelectedShip(null);
    setShipOrientation('horizontal');
  };

  // --- Battleship Handlers ---

  const handleBattleshipCellClick = (row: number, col: number) => {
    if (status === GameStatus.SETUP && selectedShip) {
      // Размещение корабля
      const ship = myShips.find((s) => s.type === selectedShip);
      if (!ship || ship.isPlaced) return;

      const placedShip = placeShip(ship, row, col, shipOrientation === 'horizontal', myShips);
      if (placedShip) {
        setMyShips((prev) =>
          prev.map((s) => (s.type === selectedShip ? placedShip : s))
        );
        haptic.light();
        setHighlightCells([]);
        setSelectedShip(null);
      } else {
        haptic.error();
      }
    } else if (status === GameStatus.PLAYING && currentGame?.current_turn === currentPlayer?.id) {
      // Выстрел
      handleBattleshipFire(row, col);
    }
  };

  const handleBattleshipCellHover = (row: number, col: number) => {
    if (status !== GameStatus.SETUP || !selectedShip) {
      setHighlightCells([]);
      return;
    }

    const ship = myShips.find((s) => s.type === selectedShip);
    if (!ship || ship.isPlaced) {
      setHighlightCells([]);
      return;
    }

    const cells: [number, number][] = [];
    for (let i = 0; i < ship.length; i++) {
      const r = shipOrientation === 'horizontal' ? row : row + i;
      const c = shipOrientation === 'horizontal' ? col + i : col;
      cells.push([r, c]);
    }

    const valid = isValidPlacement(ship, row, col, shipOrientation === 'horizontal', myShips);
    setHighlightCells(cells);
    setHighlightValid(valid);
  };

  const handleRandomizeShips = () => {
    const randomShips = generateRandomShips();
    setMyShips(randomShips);
    setSelectedShip(null);
    haptic.medium();
  };

  const handleClearShips = () => {
    setMyShips(createEmptyShips());
    setSelectedShip(null);
    haptic.light();
  };

  const handleBattleshipSetupSubmit = async () => {
    if (!currentPlayer || !currentGame || !areAllShipsPlaced(myShips)) return;

    setIsSubmitting(true);
    try {
      await GameService.setPlayerShips(currentGame.id, currentPlayer.id, myShips, isCreator);

      // Виброотклик успеха при расстановке кораблей
      haptic.success();

      setFeedback('ОЖИДАНИЕ ОППОНЕНТА...');

      // Проверка готовности обоих игроков
      const ready = await GameService.checkBothPlayersReady(currentGame.id);
      if (ready && isCreator) {
        await GameService.startGame(currentGame.id, currentPlayer.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBattleshipFire = async (row: number, col: number) => {
    if (!currentPlayer || !currentGame || isSubmitting) return;
    if (currentGame.current_turn !== currentPlayer.id) return;

    setIsSubmitting(true);
    try {
      const game = await GameService.getGame(currentGame.id);
      if (!game) return;

      // Получаем корабли оппонента
      const targetShips = isCreator ? game.opponent_ships : game.creator_ships;
      if (!targetShips) return;

      // Проверяем попадание
      const hit = checkHit(row, col, targetShips, myHits);
      if (!hit) {
        setIsSubmitting(false);
        return; // Уже стреляли сюда
      }

      // Легкая вибрация при выстреле
      haptic.light();

      // Обновляем свои выстрелы
      setMyHits((prev) => [...prev, hit]);
      await GameService.addBattleshipHit(currentGame.id, currentPlayer.id, hit, isCreator);

      // Если попадание, обновляем корабли
      if (hit.result !== 'miss') {
        const updatedShips = updateShipsAfterHit(targetShips, hit);
        await GameService.updateShipsAfterHit(currentGame.id, updatedShips, !isCreator);

        // Виброотклик успеха при попадании
        haptic.success();

        // Проверяем победу
        if (checkWin(updatedShips)) {
          await GameService.finishGame(currentGame.id, currentPlayer.id);
          return;
        }

        // При попадании НЕ переключаем ход - игрок стреляет еще раз!
        setFeedback(hit.result === 'sunk' ? '🔥 КОРАБЛЬ ПОТОПЛЕН! СТРЕЛЯЙ ЕЩЕ!' : '💥 ПОПАДАНИЕ! СТРЕЛЯЙ ЕЩЕ!');
      } else {
        // Промах - переключаем ход
        const nextPlayer = isCreator ? game.opponent_id : game.creator_id;
        if (nextPlayer) {
          await GameService.switchTurn(currentGame.id, nextPlayer);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
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

  const handleSendInvitation = async (toPlayerId: string) => {
    if (!currentPlayer || !currentGame) return;

    const invitation = await InvitationService.sendInvitation(
      currentGame.id,
      currentPlayer.id,
      toPlayerId
    );

    if (invitation) {
      haptic.success();
      alert('Приглашение отправлено!');
    } else {
      haptic.error();
      alert('Ошибка отправки приглашения');
    }
  };

  // --- Render Helpers ---

  const getCharacterById = (characterId: string): Character | null => {
    return CHARACTERS.find(c => c.id === characterId) || null;
  };

  const getPlayerAvatar = (player: Player): JSX.Element => {
    // Проверяем сначала Telegram аватар
    if (player.telegram_photo_url) {
      return (
        <img
          src={player.telegram_photo_url}
          alt={player.login || player.nickname}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            // Показываем fallback - первую букву логина
            if (target.parentElement) {
              target.parentElement.innerHTML = `<span class="text-sm font-bold">${(player.login || player.nickname || '?')[0].toUpperCase()}</span>`;
            }
          }}
        />
      );
    }

    // Затем проверяем Character аватар
    const character = getCharacterById(player.avatar);
    if (character?.avatarPath) {
      return (
        <img
          src={character.avatarPath}
          alt={player.login || player.nickname}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            if (target.parentElement) {
              target.parentElement.innerHTML = `<span class="text-sm font-bold">${(player.login || player.nickname || '?')[0].toUpperCase()}</span>`;
            }
          }}
        />
      );
    }

    // Fallback к символу аватара
    return <span className="text-lg">{player.avatar}</span>;
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
    const length = gameMode === GameMode.NUMBERS ? NUM_LENGTH : (currentGame?.word_length || 5);

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

  const renderLobby = () => {
    // Фильтрация игр
    const filteredGames = waitingGames.filter(game => {
      // Исключаем скрытые игры
      if (hiddenGames.has(game.id)) return false;

      // Применяем фильтр
      if (gameFilter === 'mine') {
        return game.creator_id === currentPlayer?.id;
      } else if (gameFilter === 'active') {
        return game.status === 'WAITING';
      }
      return true; // 'all'
    });

    const handleHideGame = (gameId: string) => {
      setHiddenGames(prev => {
        const newSet = new Set(prev);
        newSet.add(gameId);
        return newSet;
      });
      haptic.light();
    };

    const handleShowAllGames = () => {
      setHiddenGames(new Set());
      haptic.light();
    };

    // Получить градиент для режима игры
    const getGameModeGradient = (mode: string) => {
      switch(mode) {
        case 'NUMBERS':
          return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        case 'WORDS':
          return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        case 'BATTLESHIP':
          return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        default:
          return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }
    };

    return (
      <div className="relative flex flex-col h-screen overflow-hidden gradient-purple-dark">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-300"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 font-heading uppercase tracking-wider">Let's Equma</p>
                <h1 className="text-4xl font-display font-black text-white tracking-tight">
                  Best Games
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-400">{currentPlayer?.login || currentPlayer?.nickname}</p>
                  <p className="text-xs text-squid-green font-bold">{onlineCount} онлайн</p>
                </div>
                {currentPlayer && (
                  <div className="relative">
                    {getPlayerAvatar(currentPlayer)}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-squid-green rounded-full border-2 border-gray-900"></div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="ml-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  🚪
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => {
                  setGameFilter('active');
                  haptic.selection();
                }}
                className={`px-5 py-2 rounded-full font-heading font-semibold text-sm transition-all ${
                  gameFilter === 'active'
                    ? 'bg-squid-pink text-white shadow-lg shadow-pink-500/50'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                🔥 Активные
              </button>
              <button
                onClick={() => {
                  setGameFilter('all');
                  haptic.selection();
                }}
                className={`px-5 py-2 rounded-full font-heading font-semibold text-sm transition-all ${
                  gameFilter === 'all'
                    ? 'bg-squid-pink text-white shadow-lg shadow-pink-500/50'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => {
                  setGameFilter('mine');
                  haptic.selection();
                }}
                className={`px-5 py-2 rounded-full font-heading font-semibold text-sm transition-all ${
                  gameFilter === 'mine'
                    ? 'bg-squid-pink text-white shadow-lg shadow-pink-500/50'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                Мои
              </button>
              <button
                onClick={() => {
                  setShowCreateGameModal(true);
                  haptic.medium();
                }}
                className="ml-auto text-2xl hover:scale-110 transition-transform"
              >
                🔍
              </button>
            </div>
          </div>

          {/* Games Carousel */}
          <div className="flex-1 overflow-hidden px-6 pb-24">
            {hiddenGames.size > 0 && (
              <div className="mb-4">
                <button
                  onClick={handleShowAllGames}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  🔄 Показать все игры ({hiddenGames.size} скрыто)
                </button>
              </div>
            )}

            {filteredGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4 opacity-20">🎮</div>
                <h3 className="text-xl font-display font-bold text-white mb-2">Нет доступных игр</h3>
                <p className="text-gray-400 text-sm mb-6">Создайте свою игру первым!</p>
              </div>
            ) : (
              <div className="carousel-container flex gap-6 pb-4 snap-x snap-mandatory overflow-x-auto">
                {filteredGames.map((game, index) => {
                  const creator = onlinePlayers.find(p => p.id === game.creator_id);
                  const isMyGame = game.creator_id === currentPlayer?.id;
                  const gameGradient = getGameModeGradient(game.game_mode);

                  return (
                    <div
                      key={game.id}
                      className="carousel-item flex-shrink-0 w-[85vw] max-w-md animate-slide-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="game-card relative h-[420px] rounded-3xl overflow-hidden shadow-2xl">
                        {/* Background Image Placeholder */}
                        <div
                          className="absolute inset-0 game-card-image"
                          style={{
                            background: gameGradient,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          {/* Overlay Gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>

                          {/* Game Mode Icon/Placeholder */}
                          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-9xl opacity-20">
                            {game.game_mode === 'NUMBERS' ? '🔢' : game.game_mode === 'BATTLESHIP' ? '🚢' : '📝'}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="relative h-full flex flex-col justify-end p-6">
                          {/* Hide Button */}
                          <button
                            onClick={() => handleHideGame(game.id)}
                            className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-all"
                          >
                            <span className="text-xl">👁️‍🗨️</span>
                          </button>

                          {/* Prize Badge */}
                          {game.prize && (
                            <div className="absolute top-4 left-4 px-3 py-1.5 bg-yellow-500/90 backdrop-blur-sm rounded-full">
                              <p className="text-xs font-bold text-black">🏆 {game.prize}</p>
                            </div>
                          )}

                          {/* My Game Badge */}
                          {isMyGame && (
                            <div className="absolute top-16 left-4 px-3 py-1 bg-squid-green/90 backdrop-blur-sm rounded-full">
                              <p className="text-xs font-bold text-black">✅ Ваша игра</p>
                            </div>
                          )}

                          {/* Game Info */}
                          <div className="mb-4">
                            <h3 className="text-2xl font-display font-black text-white mb-2 line-clamp-2">
                              {game.game_name || `Игра от ${creator?.login || creator?.nickname || 'Игрока'}`}
                            </h3>
                            <div className="flex items-center gap-3 mb-3">
                              {creator && getPlayerAvatar(creator)}
                              <div>
                                <p className="text-sm font-heading font-semibold text-white">
                                  {creator?.login || creator?.nickname || 'Игрок'}
                                </p>
                                <p className="text-xs text-gray-300">
                                  {game.game_mode === 'NUMBERS' ? '🔢 Угадай числа' : game.game_mode === 'BATTLESHIP' ? '🚢 Морской бой' : '📝 Угадай слово'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          {!isMyGame ? (
                            <button
                              onClick={() => {
                                haptic.medium();
                                handleJoinGame(game);
                              }}
                              className="w-full bg-white hover:bg-gray-100 text-black font-display font-bold py-4 px-6 rounded-2xl flex items-center justify-between group transition-all shadow-lg"
                            >
                              <span className="text-lg">Войти в игру</span>
                              <span className="text-2xl transform group-hover:translate-x-2 transition-transform">→</span>
                            </button>
                          ) : (
                            <div className="space-y-3">
                              <div className="text-center py-3 bg-white/10 backdrop-blur-sm rounded-xl">
                                <p className="text-sm text-gray-300">⏳ Ожидание оппонента...</p>
                              </div>
                              <button
                                onClick={() => {
                                  setCurrentGame(game);
                                  setShowInviteModal(true);
                                  haptic.light();
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-heading font-bold py-3 px-6 rounded-2xl transition-all"
                              >
                                📨 Пригласить игроков
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fixed Create Game Button */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-gray-900/95 to-transparent backdrop-blur-lg z-20">
            <button
              onClick={() => {
                haptic.medium();
                setShowCreateGameModal(true);
              }}
              className="w-full bg-squid-pink hover:bg-pink-600 text-white font-display font-black py-5 px-8 rounded-2xl text-lg btn-glow transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              ✨ Создать свою игру
            </button>
          </div>
        </div>

        {/* Create Game Modal */}
        {showCreateGameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
            <div className="relative w-full max-w-lg">
              {/* Animated background blobs */}
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur-xl opacity-50 animate-pulse"></div>

              {/* Main modal content */}
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl overflow-hidden">
                {/* Close button */}
                <button
                  onClick={() => setShowCreateGameModal(false)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all group"
                >
                  <span className="text-white text-2xl group-hover:rotate-90 transition-transform duration-300">×</span>
                </button>

                {/* Header */}
                <div className="relative p-8 pb-6">
                  <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-pink-500/20 to-transparent"></div>
                  <h2 className="relative text-3xl font-display font-black text-white mb-2">
                    Создать игру
                  </h2>
                  <p className="relative text-sm text-gray-400 font-heading">
                    Настройте параметры вашей игры
                  </p>
                </div>

                {/* Content */}
                <div className="px-8 pb-8 space-y-6">
                  {/* Game Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-heading font-semibold text-gray-400 uppercase tracking-wider block">
                      Название игры
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newGameName}
                        onChange={(e) => setNewGameName(e.target.value)}
                        placeholder="Например: Игра за обед"
                        maxLength={50}
                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 focus:bg-white/10 transition-all font-heading"
                      />
                    </div>
                  </div>

                  {/* Game Mode */}
                  <div className="space-y-3">
                    <label className="text-xs font-heading font-semibold text-gray-400 uppercase tracking-wider block">
                      Режим игры
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => {
                          setNewGameMode(GameMode.NUMBERS);
                          haptic.selection();
                        }}
                        className={`group relative overflow-hidden rounded-2xl p-4 font-heading font-bold text-sm transition-all transform hover:scale-105 ${
                          newGameMode === GameMode.NUMBERS
                            ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/50'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-2xl mb-1">🔢</div>
                        <div className="text-xs">Цифры</div>
                      </button>
                      <button
                        onClick={() => {
                          setNewGameMode(GameMode.WORDS);
                          haptic.selection();
                        }}
                        className={`group relative overflow-hidden rounded-2xl p-4 font-heading font-bold text-sm transition-all transform hover:scale-105 ${
                          newGameMode === GameMode.WORDS
                            ? 'bg-gradient-to-br from-pink-600 to-pink-700 text-white shadow-lg shadow-pink-500/50'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-2xl mb-1">📝</div>
                        <div className="text-xs">Слова</div>
                      </button>
                      <button
                        onClick={() => {
                          setNewGameMode(GameMode.BATTLESHIP);
                          haptic.selection();
                        }}
                        className={`group relative overflow-hidden rounded-2xl p-4 font-heading font-bold text-sm transition-all transform hover:scale-105 ${
                          newGameMode === GameMode.BATTLESHIP
                            ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/50'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-2xl mb-1">🚢</div>
                        <div className="text-xs">Морской бой</div>
                      </button>
                    </div>
                  </div>

                  {/* Word Length - только для режима СЛОВА */}
                  {newGameMode === GameMode.WORDS && (
                    <div className="space-y-3 animate-fadeIn">
                      <label className="text-xs font-heading font-semibold text-gray-400 uppercase tracking-wider block">
                        Длина слова
                      </label>
                      <div className="flex gap-3">
                        {[5, 6, 10].map(length => (
                          <button
                            key={length}
                            onClick={() => {
                              setNewWordLength(length);
                              haptic.selection();
                            }}
                            className={`flex-1 py-3 px-4 rounded-xl font-heading font-bold text-sm transition-all transform hover:scale-105 ${
                              newWordLength === length
                                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {length} букв
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prize */}
                  <div className="space-y-2">
                    <label className="text-xs font-heading font-semibold text-gray-400 uppercase tracking-wider block">
                      Приз <span className="text-gray-600">(опционально)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl">🏆</div>
                      <input
                        type="text"
                        value={newGamePrize}
                        onChange={(e) => setNewGamePrize(e.target.value)}
                        placeholder="1000₽ или Кофе"
                        maxLength={50}
                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:bg-white/10 transition-all font-heading"
                      />
                    </div>
                  </div>

                  {/* Create Button */}
                  <button
                    onClick={() => {
                      haptic.medium();
                      handleCreateGame();
                    }}
                    className="w-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 hover:from-pink-500 hover:via-purple-500 hover:to-blue-500 text-white font-display font-black py-4 px-6 rounded-2xl text-lg shadow-lg shadow-pink-500/50 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
                  >
                    ✨ Создать игру
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invite Players Modal */}
        {showInviteModal && currentGame && (
          <Modal onClose={() => setShowInviteModal(false)}>
            <h2 className="text-2xl font-black text-squid-pink mb-4">ПРИГЛАСИТЬ УЧАСТНИКОВ</h2>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={inviteSearchQuery}
                onChange={(e) => setInviteSearchQuery(e.target.value)}
                placeholder="Поиск по логину..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-squid-pink"
              />
            </div>

            {/* Players List */}
            <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
              {onlinePlayers
                .filter(p =>
                  !inviteSearchQuery ||
                  p.login?.toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
                  p.nickname?.toLowerCase().includes(inviteSearchQuery.toLowerCase())
                )
                .map(player => (
                  <div
                    key={player.id}
                    className="bg-gray-800/50 rounded p-3 flex items-center justify-between border border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      {getPlayerAvatar(player)}
                      <div>
                        <div className="text-sm text-white font-bold">
                          {player.login || player.nickname}
                        </div>
                        <div className="text-xs text-gray-400">
                          🟢 Онлайн
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleSendInvitation(player.id);
                        haptic.medium();
                      }}
                      className="bg-squid-green hover:bg-green-700 text-black text-xs px-3 py-2 rounded font-bold"
                    >
                      ПРИГЛАСИТЬ
                    </button>
                  </div>
                ))}
            </div>
          </Modal>
        )}
      </div>
    );
  };

  const renderBattleshipGame = () => {
    if (status === GameStatus.SETUP) {
      // Режим размещения кораблей
      return (
        <div className="min-h-screen bg-squid-dark flex flex-col items-center justify-center p-4">
          <div className="max-w-6xl w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-squid-pink mb-2">МОРСКОЙ БОЙ</h2>
              <p className="text-sm text-gray-400">{feedback}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
              {/* Левая панель - размещение кораблей */}
              <div className="bg-squid-panel border border-gray-800 rounded p-4">
                <ShipPlacer
                  ships={myShips}
                  selectedShip={selectedShip}
                  onSelectShip={setSelectedShip}
                  orientation={shipOrientation}
                  onToggleOrientation={() => setShipOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))}
                  onRandomize={handleRandomizeShips}
                  onClear={handleClearShips}
                  onReady={handleBattleshipSetupSubmit}
                  canSubmit={areAllShipsPlaced(myShips)}
                />
              </div>

              {/* Правая панель - поле */}
              <div className="flex items-center justify-center">
                <div
                  onMouseLeave={() => setHighlightCells([])}
                >
                  <BattleshipGrid
                    mode="setup"
                    ships={myShips}
                    hits={[]}
                    onCellClick={handleBattleshipCellClick}
                    showShips={true}
                    highlightCells={highlightCells}
                    isValid={highlightValid}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={handleBackToLobby}
                className="text-sm text-red-500 hover:text-red-400 font-bold"
              >
                ← ВЕРНУТЬСЯ В ЛОББИ
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Режим игры
    return (
      <div className="h-screen flex flex-col bg-squid-dark">
        {/* Заголовок */}
        <div className="sticky top-0 z-30 bg-squid-dark px-4 pt-3 pb-2 border-b border-gray-800">
          {status === GameStatus.PLAYING && (
            <div className="mb-2">
              <Timer
                duration={TURN_DURATION}
                onTimeUp={handleTimeUp}
                isActive={true}
                resetKey={timerResetKey}
              />
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              {getOpponentAvatar()}
              <span className="text-sm text-gray-400">{getOpponentNickname()}</span>
            </div>
            <div className="flex items-center gap-3">
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

        {/* Информация */}
        <div className="sticky top-[57px] z-20 bg-squid-dark px-4 pb-2">
          <div className="bg-squid-panel border-l-4 border-squid-pink p-2 mb-2 font-mono text-sm text-center shadow-lg text-white">
            {feedback}
          </div>
        </div>

        {/* Игровые поля */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Поле оппонента (для стрельбы) */}
            <div className="bg-squid-panel border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-squid-pink mb-3 text-center">
                ПОЛЕ ПРОТИВНИКА
              </h3>
              <div className="flex justify-center">
                <BattleshipGrid
                  mode="playing"
                  ships={opponentShips}
                  hits={myHits}
                  onCellClick={handleBattleshipCellClick}
                  isMyTurn={currentGame?.current_turn === currentPlayer?.id}
                  showShips={false}
                />
              </div>
            </div>

            {/* Моё поле */}
            <div className="bg-squid-panel border border-gray-800 rounded p-4">
              <h3 className="text-sm font-bold text-squid-green mb-3 text-center">
                ВАШЕ ПОЛЕ
              </h3>
              <div className="flex justify-center">
                <BattleshipGrid
                  mode="playing"
                  ships={myShips}
                  hits={opponentHits}
                  onCellClick={() => {}}
                  isMyTurn={false}
                  showShips={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Game Over Modal */}
        {status === GameStatus.GAME_OVER && currentGame && (
          <Modal>
            <div className="text-center space-y-6">
              <h2 className={`text-3xl font-black ${currentGame.winner_id === currentPlayer?.id ? 'text-squid-green' : 'text-squid-pink'}`}>
                {currentGame.winner_id === currentPlayer?.id ? 'ВЫ ПОБЕДИЛИ' : 'ВЫ ПРОИГРАЛИ'}
              </h2>
              <p className="font-mono text-sm text-gray-300">
                {currentGame.winner_id === currentPlayer?.id
                  ? 'ВЫ ПОТОПИЛИ ВСЕ КОРАБЛИ!'
                  : 'ВСЕ ВАШИ КОРАБЛИ ПОТОПЛЕНЫ.'}
              </p>
              {currentGame.prize && currentGame.winner_id === currentPlayer?.id && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-600 rounded">
                  <p className="text-yellow-400 font-bold text-lg">🏆 ВЫ ВЫИГРАЛИ</p>
                  <p className="text-yellow-300 text-xl mt-2">{currentGame.prize}</p>
                </div>
              )}
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

  const renderGame = () => {
    // Если это морской бой, используем отдельный рендер
    if (gameMode === GameMode.BATTLESHIP) {
      return renderBattleshipGame();
    }

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
                className={`w-7 h-7 sm:w-9 sm:h-9 border-2 flex items-center justify-center text-sm sm:text-base font-bold rounded-lg transition-all ${
                  isMatch
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 text-white shadow-lg'
                    : 'bg-gray-800/50 border-gray-600 text-gray-400'
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
    const isMyTurn = currentGame?.current_turn === currentPlayer?.id;

    return (
      <div className="h-screen flex flex-col mx-auto relative max-w-4xl bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
        {/* Sticky Header с таймером по центру */}
        <div className="sticky top-0 z-30 bg-gradient-to-b from-gray-900 to-gray-900/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-gray-700/50">
          {/* Timer at the very top */}
          {status === GameStatus.PLAYING && (
            <div className="mb-4">
              <Timer
                duration={TURN_DURATION}
                onTimeUp={handleTimeUp}
                isActive={true}
                resetKey={timerResetKey}
              />
            </div>
          )}

          {/* Два шейпа игроков - слева и справа */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            {/* Левый шейп - Я */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-3 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                  {currentPlayer && getPlayerAvatar(currentPlayer)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {currentPlayer?.login || currentPlayer?.nickname}
                  </div>
                  <div className="text-xs text-blue-300">ВЫ</div>
                </div>
              </div>
              {/* Мое загаданное слово */}
              {status !== GameStatus.SETUP && mySecret && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">МОЁ СЛОВО:</div>
                  <div className="flex gap-1 flex-wrap">
                    {mySecret.split('').map((char, idx) => {
                      const isRevealed = myRevealedIndices[idx];
                      return (
                        <div
                          key={idx}
                          className={`w-6 h-7 flex items-center justify-center text-xs font-mono font-bold rounded transition-all ${
                            isRevealed
                              ? 'bg-gradient-to-br from-red-500 to-pink-600 text-white border-2 border-red-400 shadow-lg animate-pulse'
                              : 'bg-gray-800/70 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Правый шейп - Оппонент */}
            <div className="bg-gradient-to-br from-pink-600/20 to-orange-600/20 backdrop-blur-sm rounded-2xl p-3 border border-pink-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold shadow-lg">
                  {getOpponentAvatar()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {getOpponentNickname()}
                  </div>
                  <div className="text-xs text-pink-300">ОППОНЕНТ</div>
                </div>
              </div>
              {/* Блок оппонента с звездочками и открытыми буквами */}
              {status !== GameStatus.SETUP && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">ЕГО СЛОВО:</div>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: gameMode === GameMode.NUMBERS ? NUM_LENGTH : (currentGame?.word_length || 5) }).map((_, idx) => {
                      const secret = opponentSecretValue || '';
                      const char = secret[idx] || '*';
                      const isRevealed = opponentRevealedIndices[idx];
                      const showChar = isRevealed || status === GameStatus.GAME_OVER;

                      return (
                        <div
                          key={idx}
                          className={`w-6 h-7 flex items-center justify-center text-xs font-mono font-bold rounded transition-all ${
                            isRevealed
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-2 border-green-400 shadow-lg'
                              : 'bg-gray-800/70 text-gray-500 border border-pink-500/30'
                          }`}
                        >
                          {showChar ? char : '★'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка выхода и раунд */}
          <div className="flex justify-between items-center text-xs">
            <div className="font-mono text-gray-400">
              {currentGame?.prize && <span className="text-yellow-400 mr-2">💰 {currentGame.prize}</span>}
              РАУНД {currentGame?.turn_count || 0}
            </div>
            <button onClick={handleBackToLobby} className="text-red-400 font-bold hover:text-red-300 uppercase">
              Выход
            </button>
          </div>
        </div>

        {/* Панель статуса с пульсацией */}
        <div className="sticky top-[200px] z-20 bg-gray-900/95 backdrop-blur-sm px-4 pb-2">
          <div className={`p-3 rounded-xl font-bold text-sm text-center shadow-lg transition-all ${
            status === GameStatus.PLAYING && isMyTurn
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white animate-pulse shadow-green-500/50'
              : status === GameStatus.PLAYING
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-blue-500/30'
          }`}>
            {feedback}
          </div>

          {/* My Secret Display - только для SETUP режима */}
          {status === GameStatus.SETUP && (
            <div className="mb-2 mt-3">
              {renderSecretDisplay(true)}
            </div>
          )}
        </div>

        {/* History - scrollable area with improved styling */}
        <div className="flex-1 px-4 pb-2 overflow-hidden">
          <div className="h-full overflow-y-auto pb-4" ref={scrollRef} style={{ scrollBehavior: 'smooth' }}>
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-gradient-to-b from-gray-900 to-gray-900/90 backdrop-blur-md py-3 z-10 rounded-xl">
            <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-wider">
              📊 История ходов
            </h3>
            <span className="text-xs text-gray-500 font-mono px-3 py-1 bg-gray-800/50 rounded-full">
              {guesses.length}
            </span>
          </div>
          {guesses.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-12">
              <div className="text-6xl mb-4 opacity-20">🎯</div>
              <div className="font-bold text-gray-400">История пуста</div>
              <div className="text-xs text-gray-600 mt-2">Начните угадывать!</div>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {guesses.map((guess, idx) => {
                const isMine = guess.player_id === currentPlayer?.id;
                const targetSecret = isMine ? (opponentSecretValue || '') : (mySecret || '');

                return (
                  <div
                    key={guess.id || idx}
                    className={`rounded-xl p-3 border-2 transition-all transform hover:scale-[1.02] ${
                      isMine
                        ? 'bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/40 shadow-lg shadow-blue-500/10'
                        : 'bg-gradient-to-br from-pink-600/10 to-orange-600/10 border-pink-500/40 shadow-lg shadow-pink-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          isMine
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                            : 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                        }`}>
                          {isMine ? 'ВЫ' : 'ОПОНЕНТ'}
                        </span>
                        <span className="text-xs text-gray-500 font-mono px-2 py-1 bg-gray-800/50 rounded">
                          #{idx + 1}
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        guess.result.includes('ВЕРНО')
                          ? 'bg-green-500/20 text-green-400'
                          : guess.result.includes('ОТКРЫТО')
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-700/50 text-gray-400'
                      }`}>
                        {guess.result}
                      </span>
                    </div>
                    {renderGuessSquares(guess, targetSecret)}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Controls Area - Fixed at bottom */}
        <div className="sticky bottom-0 z-20 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent backdrop-blur-lg px-4 pt-4 pb-4 border-t border-gray-700/50">
          {/* Input Display */}
          {((status === GameStatus.PLAYING && currentGame?.current_turn === currentPlayer?.id) || status === GameStatus.SETUP) && (
            <div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: gameMode === GameMode.NUMBERS ? NUM_LENGTH : (currentGame?.word_length || 5) }).map((_, i) => (
                <div key={i} className="w-12 h-14 border-2 border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg flex items-center justify-center text-2xl font-mono text-white font-bold shadow-lg backdrop-blur-sm">
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
                {currentGame.winner_id === currentPlayer?.id ? 'ВЫ ПОБЕДИЛИ' : 'ВЫ ПРО*БАЛИ'}
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
