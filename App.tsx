import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, PlayerType, GameStatus, PlayerState, TurnHistoryItem } from './types';
import { generateAISecretNumber, generateAISecretWord, getAIGuessForNumber, getAIGuessForWord } from './services/ai';
import Timer from './components/Timer';
import { Keyboard } from './components/Keyboard';

// --- Constants ---
const NUM_LENGTH = 4;
const WORD_LENGTH = 5;
const TURN_DURATION = 60; // 60 seconds

// --- Helper Types for Fake Lobby ---
interface LobbyPlayer {
  id: string;
  status: 'WAITING' | 'PLAYING';
  avatar: '○' | '△' | '□';
}

// --- Helper Components ---

const GeometricIcon = ({ type, className = "" }: { type: 'circle' | 'triangle' | 'square', className?: string }) => {
  if (type === 'circle') return <div className={`border-4 rounded-full w-8 h-8 flex items-center justify-center ${className}`}></div>;
  if (type === 'triangle') return <div className={`w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[32px] ${className.replace('border-', 'border-b-')}`}></div>;
  return <div className={`border-4 w-8 h-8 ${className}`}></div>;
};

const Modal = ({ children }: { children?: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
    <div className="bg-squid-panel border-2 border-squid-pink p-6 max-w-sm w-full shadow-[0_0_20px_rgba(255,0,122,0.3)] relative text-center">
       {children}
    </div>
  </div>
);

// --- Main App Component ---

const App: React.FC = () => {
  // Global State
  const [visitorId] = useState<string>(() => `ИГРОК-${Math.floor(100 + Math.random() * 899)}`);
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOBBY);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.NONE);
  const [turn, setTurn] = useState<PlayerType>(PlayerType.USER);
  const [turnCount, setTurnCount] = useState(0);
  const [winner, setWinner] = useState<PlayerType | null>(null);

  // Lobby State (Simulated Multiplayer)
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<LobbyPlayer | null>(null);

  // Player States
  const [userState, setUserState] = useState<PlayerState>({ id: visitorId, secret: '', revealedIndices: [] });
  const [aiState, setAiState] = useState<PlayerState>({ id: '???', secret: '', revealedIndices: [] });

  // Gameplay State
  const [currentInput, setCurrentInput] = useState('');
  const [history, setHistory] = useState<TurnHistoryItem[]>([]);
  const [feedback, setFeedback] = useState<string>('ОЖИДАНИЕ...');
  
  // Timer State
  const [timerResetKey, setTimerResetKey] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Generate Fake Lobby Players
  useEffect(() => {
    if (status === GameStatus.LOBBY) {
      const shapes: ('○' | '△' | '□')[] = ['○', '△', '□'];
      const fakeIds = Array.from({ length: 5 }).map((_, i) => ({
        id: `ИГРОК-${Math.floor(200 + Math.random() * 799)}`,
        status: Math.random() > 0.3 ? 'WAITING' : 'PLAYING',
        avatar: shapes[i % 3]
      })) as LobbyPlayer[];
      setLobbyPlayers(fakeIds);
    }
  }, [status]);

  // Scroll history to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // AI Turn Logic
  useEffect(() => {
    if (status === GameStatus.PLAYING && turn === PlayerType.AI) {
        const performAiTurn = async () => {
            // Artificial delay for "Thinking"
            setFeedback(`${aiState.id} ДУМАЕТ...`);
            await new Promise(r => setTimeout(r, 2000)); // 2 seconds

            let guess = '';
            const length = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
            
            if (gameMode === GameMode.NUMBERS) {
                guess = await getAIGuessForNumber(history, userState.revealedIndices.map((r, i) => r ? userState.secret[i] : null));
            } else {
                guess = await getAIGuessForWord(history, userState.revealedIndices.map((r, i) => r ? userState.secret[i] : null), length);
            }

            setFeedback(`${aiState.id} ВЫБРАЛ: ${guess}`);
            handleTurnResult(PlayerType.AI, guess);
        };
        performAiTurn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, turn, gameMode]);

  // --- Handlers ---

  const handleConnectToPlayer = (opponent: LobbyPlayer, mode: GameMode) => {
    setSelectedOpponent(opponent);
    setGameMode(mode);
    setStatus(GameStatus.SETUP);
    setCurrentInput('');
    setHistory([]);
    setFeedback(mode === GameMode.NUMBERS ? "ЗАГАДАЙ 4 ЦИФРЫ" : "ЗАГАДАЙ СЛОВО (5 БУКВ)");
    
    // Initialize empty revealed states
    const len = mode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
    setUserState(prev => ({ ...prev, secret: '', revealedIndices: Array(len).fill(false) }));
    setAiState(prev => ({ ...prev, id: opponent.id, secret: '', revealedIndices: Array(len).fill(false) }));
  };

  const handleSetupSubmit = async () => {
    const len = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
    if (currentInput.length !== len) return;

    // Set User Secret
    setUserState(prev => ({ ...prev, secret: currentInput }));
    setFeedback("ОЖИДАНИЕ ОППОНЕНТА...");

    // Generate AI Secret (Simulate opponent thinking)
    await new Promise(r => setTimeout(r, 1000));
    
    let aiSecret = '';
    if (gameMode === GameMode.NUMBERS) {
      aiSecret = await generateAISecretNumber();
    } else {
      aiSecret = await generateAISecretWord();
    }
    
    setAiState(prev => ({ ...prev, secret: aiSecret }));
    
    // Start Game
    setStatus(GameStatus.PLAYING);
    setTurn(PlayerType.USER); // User goes first usually
    setCurrentInput('');
    setFeedback("ИГРА НАЧАЛАСЬ. ТВОЙ ХОД.");
    setTimerResetKey(k => k + 1);
  };

  const handleTurnResult = (player: PlayerType, guess: string) => {
    const isUser = player === PlayerType.USER;
    const targetState = isUser ? aiState : userState;
    const setTargetState = isUser ? setAiState : setUserState;
    const targetSecret = targetState.secret;
    
    // Logic: If char at index matches strictly by position, reveal it.
    let newRevealed = [...targetState.revealedIndices];
    let matchCount = 0;
    const isWin = guess === targetSecret;

    if (isWin) {
      // Full match - reveal all
      newRevealed = newRevealed.map(() => true);
    } else {
      // Partial match check (Strict Position)
      for (let i = 0; i < targetSecret.length; i++) {
        if (guess[i] === targetSecret[i]) {
          newRevealed[i] = true;
          matchCount++;
        }
      }
    }

    // Update revealed state
    setTargetState(prev => ({ ...prev, revealedIndices: newRevealed }));

    // Add History
    const resultText = isWin ? "ВЕРНО!" : (matchCount > 0 ? `ОТКРЫТО: ${matchCount}` : "НЕТ СОВПАДЕНИЙ");
    setHistory(prev => [...prev, {
      player,
      guess,
      result: resultText,
      timestamp: Date.now()
    }]);

    if (isWin) {
      setWinner(player);
      setStatus(GameStatus.GAME_OVER);
    } else {
        // Switch Turn
        setTurn(prev => prev === PlayerType.USER ? PlayerType.AI : PlayerType.USER);
        setCurrentInput('');
        setTurnCount(c => c + 1);
        setTimerResetKey(k => k + 1);
        
        if (isUser) {
            setFeedback(`ХОДИТ: ${aiState.id}...`);
        } else {
            setFeedback("ТВОЙ ХОД");
        }
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

  const handleSubmitGuess = () => {
    const len = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;
    if (currentInput.length !== len) return;
    handleTurnResult(PlayerType.USER, currentInput);
  };

  const handleTimeUp = useCallback(() => {
    if (status !== GameStatus.PLAYING) return;
    
    setFeedback("ВРЕМЯ ИСТЕКЛО. ХОД ПЕРЕХОДИТ.");
    
    // Penalty: Skip turn
    setTurn(prev => prev === PlayerType.USER ? PlayerType.AI : PlayerType.USER);
    setTimerResetKey(k => k + 1);
  }, [status]);

  // --- Renders ---

  const renderSecretDisplay = (player: PlayerType) => {
    const isMe = player === PlayerType.USER;
    const state = isMe ? userState : aiState;
    const secret = state.secret;
    const revealed = state.revealedIndices;
    const length = gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH;

    // During setup, User sees their own input
    if (status === GameStatus.SETUP && isMe) {
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
            {isMe ? <span className="text-squid-green">ВЫ ({state.id})</span> : <span className="text-squid-pink">{state.id}</span>}
            {turn === player && status === GameStatus.PLAYING && <span className="w-2 h-2 rounded-full bg-white animate-ping"/>}
        </div>
        <div className="flex gap-1 sm:gap-2">
          {Array.from({ length }).map((_, i) => {
            const char = secret[i];
            const isRevealed = revealed[i];
            const showChar = isRevealed || (isMe && status !== GameStatus.GAME_OVER); 

            return (
              <div key={i} className={`
                w-8 h-12 sm:w-12 sm:h-16 border-2 flex items-center justify-center text-lg sm:text-2xl font-mono transition-all duration-300
                ${isMe ? 'border-squid-green text-squid-green' : 'border-squid-pink text-squid-pink'}
                ${isRevealed ? 'bg-gray-800' : 'bg-squid-panel'}
              `}>
                {showChar ? char : (isRevealed ? char : '*')}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLobby = () => (
    <div className="flex flex-col h-screen p-4 animate-fadeIn bg-squid-dark">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl font-black tracking-widest text-white">ИГРА В<br/><span className="text-squid-pink">КАЛЬМАРА</span></h1>
        <p className="text-squid-green font-mono text-xs tracking-widest">ВАШ ID: {visitorId}</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-900/50 border border-gray-800 rounded p-2 mb-4">
          <h2 className="text-xs font-mono text-gray-500 mb-3 border-b border-gray-700 pb-2">ОНЛАЙН ИГРОКИ</h2>
          <div className="space-y-3">
              {lobbyPlayers.map((p) => (
                  <div key={p.id} className="bg-squid-panel border border-gray-700 p-3 rounded flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="text-squid-pink font-bold text-lg">{p.avatar}</div>
                          <div>
                              <div className="text-white text-sm font-bold">{p.id}</div>
                              <div className="text-[10px] text-gray-400">{p.status === 'WAITING' ? 'ОЖИДАЕТ' : 'В ИГРЕ'}</div>
                          </div>
                      </div>
                      {p.status === 'WAITING' ? (
                          <div className="flex gap-2">
                             <button 
                                onClick={() => handleConnectToPlayer(p, GameMode.NUMBERS)}
                                className="bg-squid-pink hover:bg-pink-700 text-white text-[10px] px-3 py-2 rounded font-bold tracking-wider"
                             >
                                123
                             </button>
                             <button 
                                onClick={() => handleConnectToPlayer(p, GameMode.WORDS)}
                                className="bg-squid-green hover:bg-green-700 text-black text-[10px] px-3 py-2 rounded font-bold tracking-wider"
                             >
                                АБВ
                             </button>
                          </div>
                      ) : (
                          <span className="text-xs text-gray-600 font-mono">ЗАНЯТ</span>
                      )}
                  </div>
              ))}
          </div>
      </div>
      
      <div className="text-center text-gray-600 text-[10px] font-mono">
        СЕРВЕР: ХАКАСИЯ-1 • ПОДКЛЮЧЕНИЕ СТАБИЛЬНО
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto p-4 relative">
        {/* Header */}
        <div className="flex justify-between items-center py-4 border-b border-gray-800 mb-4">
            <div className="flex gap-2 text-squid-pink">
               {selectedOpponent?.avatar}
            </div>
            <div className="font-mono text-xs text-gray-400">РАУНД {turnCount + 1}</div>
            <button onClick={() => setStatus(GameStatus.LOBBY)} className="text-xs text-red-500 font-bold hover:underline uppercase">Выход</button>
        </div>

        {/* Info Banner */}
        <div className="bg-squid-panel border-l-4 border-squid-pink p-3 mb-6 font-mono text-sm text-center shadow-lg text-white">
            {feedback}
        </div>

        {/* Game Board */}
        <div className="flex-1 overflow-y-auto mb-4" ref={scrollRef}>
             {/* Opponent Display (Top) */}
             {status !== GameStatus.SETUP && renderSecretDisplay(PlayerType.AI)}

            {/* History Feed */}
            <div className="space-y-2 my-6 px-2 sm:px-4">
                {history.map((h, idx) => (
                    <div key={idx} className={`flex ${h.player === PlayerType.USER ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            p-2 rounded max-w-[85%] text-xs sm:text-sm font-mono
                            ${h.player === PlayerType.USER ? 'bg-squid-green/20 text-squid-green border border-squid-green/50' : 'bg-squid-pink/20 text-squid-pink border border-squid-pink/50'}
                        `}>
                            <div className="opacity-70 mb-1">{h.player === PlayerType.USER ? 'ВЫ' : aiState.id}: {h.guess}</div>
                            <div className="font-bold">{h.result}</div>
                        </div>
                    </div>
                ))}
            </div>

             {/* User Display (Bottom/Middle) */}
             {status !== GameStatus.SETUP && renderSecretDisplay(PlayerType.USER)}
             
             {/* Setup Display */}
             {status === GameStatus.SETUP && renderSecretDisplay(PlayerType.USER)}
        </div>

        {/* Controls Area */}
        <div className="mt-auto bg-squid-dark pt-2 pb-4 sticky bottom-0 z-10">
             {status === GameStatus.PLAYING && (
                 <Timer 
                    duration={TURN_DURATION} 
                    onTimeUp={handleTimeUp} 
                    isActive={true} 
                    resetKey={timerResetKey}
                 />
             )}
             
             {/* Input Display (For Guessing) */}
             {status === GameStatus.PLAYING && turn === PlayerType.USER && (
                 <div className="flex justify-center gap-2 mb-4">
                     {Array.from({ length: gameMode === GameMode.NUMBERS ? NUM_LENGTH : WORD_LENGTH }).map((_, i) => (
                         <div key={i} className="w-8 h-10 sm:w-10 sm:h-12 border-b-2 border-white flex items-center justify-center text-xl font-mono text-white">
                             {currentInput[i] || ''}
                         </div>
                     ))}
                 </div>
             )}

             <Keyboard 
                mode={gameMode === GameMode.NUMBERS ? 'NUMERIC' : 'ALPHA'}
                onInput={handleInput}
                onDelete={handleDelete}
                onSubmit={status === GameStatus.SETUP ? handleSetupSubmit : handleSubmitGuess}
                disabled={status === GameStatus.PLAYING && turn !== PlayerType.USER}
                usedKeys={[]} 
             />
        </div>

        {/* Game Over Modal */}
        {status === GameStatus.GAME_OVER && (
             <Modal>
                <div className="text-center space-y-6">
                    <h2 className={`text-3xl font-black ${winner === PlayerType.USER ? 'text-squid-green' : 'text-squid-pink'}`}>
                        {winner === PlayerType.USER ? 'ПОБЕДА' : 'ВЫБЫЛ'}
                    </h2>
                    <p className="font-mono text-sm text-gray-300">
                        {winner === PlayerType.USER 
                         ? `ВЫ РАЗГАДАЛИ КОД.` 
                         : `ОППОНЕНТ ОКАЗАЛСЯ БЫСТРЕЕ.`}
                    </p>
                    <div className="p-4 bg-black/50 rounded border border-gray-700">
                        <p className="text-xs text-gray-500 mb-1">СЕКРЕТ {aiState.id}</p>
                        <p className="text-xl tracking-widest text-squid-pink">{aiState.secret}</p>
                    </div>
                    <button 
                        onClick={() => setStatus(GameStatus.LOBBY)}
                        className="w-full py-3 bg-white text-black font-bold hover:bg-gray-200 transition-colors rounded"
                    >
                        ВЕРНУТЬСЯ В МЕНЮ
                    </button>
                </div>
             </Modal>
        )}
    </div>
  );

  return (
    <div className="bg-squid-dark min-h-screen text-white overflow-hidden font-sans">
      {status === GameStatus.LOBBY ? renderLobby() : renderGame()}
    </div>
  );
};

export default App;