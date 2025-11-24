import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Running in offline mode.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Типы для БД
export interface Player {
  id: string;
  login: string | null;
  nickname: string;
  avatar: '○' | '△' | '□';
  telegram_id?: number | null;
  telegram_photo_url?: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  rating?: number;
  games_won?: number;
  games_lost?: number;
  games_draw?: number;
}

export interface Game {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  game_mode: 'NUMBERS' | 'WORDS' | 'BATTLESHIP';
  status: 'WAITING' | 'SETUP' | 'PLAYING' | 'FINISHED';
  prize: string | null;
  game_name: string | null;
  word_length: number; // Длина слова для режима WORDS (5, 6, 10)
  creator_secret: string | null;
  opponent_secret: string | null;
  creator_revealed_indices: boolean[];
  opponent_revealed_indices: boolean[];
  creator_ships: any | null; // JSON корабли создателя для морского боя
  opponent_ships: any | null; // JSON корабли оппонента для морского боя
  creator_hits: any[]; // JSON выстрелы создателя для морского боя
  opponent_hits: any[]; // JSON выстрелы оппонента для морского боя
  current_turn: string | null;
  winner_id: string | null;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

export interface Guess {
  id: string;
  game_id: string;
  player_id: string;
  guess: string;
  result: string;
  matches_count: number;
  created_at: string;
}

export interface Invitation {
  id: string;
  game_id: string;
  from_player_id: string;
  to_player_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  created_at: string;
  updated_at: string;
}

// Сервис для работы с игроками
export class PlayerService {
  // Создать нового игрока с логином
  static async createPlayer(
    login: string,
    avatar: '○' | '△' | '□',
    telegramId?: number | null,
    telegramPhotoUrl?: string | null
  ): Promise<Player | null> {
    const { data, error } = await supabase
      .from('players')
      .insert([{
        login,
        nickname: login,
        avatar,
        is_online: true,
        telegram_id: telegramId || null,
        telegram_photo_url: telegramPhotoUrl || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating player:', error);
      return null;
    }

    return data;
  }

  // Проверить доступность логина
  static async isLoginAvailable(login: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .ilike('login', login)
      .limit(1);

    if (error) {
      console.error('Error checking login:', error);
      // При ошибке считаем логин доступным, чтобы не блокировать вход
      // Реальная проверка произойдет при создании игрока (уникальный индекс в БД)
      return true;
    }

    // Логин доступен, если не найдено ни одного игрока с таким логином
    return data.length === 0;
  }

  // Обновить статус онлайн
  static async updateOnlineStatus(playerId: string, isOnline: boolean): Promise<void> {
    await supabase
      .from('players')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('id', playerId);
  }

  // Получить онлайн игроков
  static async getOnlinePlayers(): Promise<Player[]> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('is_online', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching online players:', error);
      return [];
    }

    return data || [];
  }

  // Подсчитать онлайн игроков
  static async countOnlinePlayers(): Promise<number> {
    const { count, error } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true);

    if (error) {
      console.error('Error counting online players:', error);
      return 0;
    }

    return count || 0;
  }

  // Подписаться на изменения онлайн игроков
  static subscribeToOnlinePlayers(callback: (players: Player[]) => void): RealtimeChannel {
    return supabase
      .channel('online-players')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players'
      }, async () => {
        const players = await PlayerService.getOnlinePlayers();
        callback(players);
      })
      .subscribe();
  }
}

// Сервис для работы с играми
export class GameService {
  // Создать новую игру
  static async createGame(
    creatorId: string,
    gameMode: 'NUMBERS' | 'WORDS' | 'BATTLESHIP',
    prize?: string,
    gameName?: string,
    wordLength?: number
  ): Promise<Game | null> {
    const { data, error} = await supabase
      .from('games')
      .insert([{
        creator_id: creatorId,
        game_mode: gameMode,
        status: 'WAITING',
        prize: prize || null,
        game_name: gameName || null,
        word_length: wordLength || 5,
        creator_revealed_indices: [],
        opponent_revealed_indices: [],
        creator_hits: [],
        opponent_hits: []
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return null;
    }

    return data;
  }

  // Присоединиться к игре
  static async joinGame(gameId: string, opponentId: string): Promise<Game | null> {
    const { data, error } = await supabase
      .from('games')
      .update({
        opponent_id: opponentId,
        status: 'SETUP'
      })
      .eq('id', gameId)
      .select()
      .single();

    if (error) {
      console.error('Error joining game:', error);
      return null;
    }

    return data;
  }

  // Установить секрет игрока
  static async setPlayerSecret(
    gameId: string,
    playerId: string,
    secret: string,
    isCreator: boolean
  ): Promise<void> {
    const field = isCreator ? 'creator_secret' : 'opponent_secret';
    const revealedField = isCreator ? 'creator_revealed_indices' : 'opponent_revealed_indices';
    const revealedIndices = Array(secret.length).fill(false);

    await supabase
      .from('games')
      .update({
        [field]: secret,
        [revealedField]: revealedIndices
      })
      .eq('id', gameId);
  }

  // Проверить, готовы ли оба игрока (установили секреты или корабли)
  static async checkBothPlayersReady(gameId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('games')
      .select('game_mode, creator_secret, opponent_secret, creator_ships, opponent_ships')
      .eq('id', gameId)
      .single();

    if (error) return false;

    // Для морского боя проверяем корабли
    if (data?.game_mode === 'BATTLESHIP') {
      return !!(data?.creator_ships && data?.opponent_ships);
    }

    // Для остальных режимов проверяем секреты
    return !!(data?.creator_secret && data?.opponent_secret);
  }

  // Начать игру
  static async startGame(gameId: string, firstPlayerId: string): Promise<void> {
    await supabase
      .from('games')
      .update({
        status: 'PLAYING',
        current_turn: firstPlayerId
      })
      .eq('id', gameId);
  }

  // Обновить открытые индексы
  static async updateRevealedIndices(
    gameId: string,
    playerId: string,
    revealedIndices: boolean[],
    isCreator: boolean
  ): Promise<void> {
    const field = isCreator ? 'creator_revealed_indices' : 'opponent_revealed_indices';

    await supabase
      .from('games')
      .update({ [field]: revealedIndices })
      .eq('id', gameId);
  }

  // Переключить ход
  static async switchTurn(gameId: string, nextPlayerId: string): Promise<void> {
    const { data: game } = await supabase
      .from('games')
      .select('turn_count')
      .eq('id', gameId)
      .single();

    await supabase
      .from('games')
      .update({
        current_turn: nextPlayerId,
        turn_count: (game?.turn_count || 0) + 1
      })
      .eq('id', gameId);
  }

  // Завершить игру
  static async finishGame(gameId: string, winnerId: string): Promise<void> {
    await supabase
      .from('games')
      .update({
        status: 'FINISHED',
        winner_id: winnerId
      })
      .eq('id', gameId);
  }

  // Получить игру по ID
  static async getGame(gameId: string): Promise<Game | null> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) {
      console.error('Error fetching game:', error);
      return null;
    }

    return data;
  }

  // Получить игры в режиме ожидания (лобби)
  static async getWaitingGames(): Promise<Game[]> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'WAITING')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching waiting games:', error);
      return [];
    }

    return data || [];
  }

  // Подписаться на изменения игры
  static subscribeToGame(gameId: string, callback: (game: Game) => void): RealtimeChannel {
    return supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, async (payload) => {
        callback(payload.new as Game);
      })
      .subscribe();
  }

  // Подписаться на игры в лобби
  static subscribeToLobbyGames(callback: (games: Game[]) => void): RealtimeChannel {
    return supabase
      .channel('lobby-games')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games'
      }, async () => {
        const games = await GameService.getWaitingGames();
        callback(games);
      })
      .subscribe();
  }

  // --- Методы для Морского боя ---

  // Установить корабли игрока
  static async setPlayerShips(
    gameId: string,
    playerId: string,
    ships: any,
    isCreator: boolean
  ): Promise<void> {
    const field = isCreator ? 'creator_ships' : 'opponent_ships';

    await supabase
      .from('games')
      .update({ [field]: ships })
      .eq('id', gameId);
  }

  // Добавить выстрел
  static async addBattleshipHit(
    gameId: string,
    playerId: string,
    hit: any,
    isCreator: boolean
  ): Promise<void> {
    const field = isCreator ? 'creator_hits' : 'opponent_hits';

    // Получаем текущие выстрелы
    const { data: game } = await supabase
      .from('games')
      .select(field)
      .eq('id', gameId)
      .single();

    if (!game) return;

    const currentHits = game[field] || [];
    const updatedHits = [...currentHits, hit];

    await supabase
      .from('games')
      .update({ [field]: updatedHits })
      .eq('id', gameId);
  }

  // Обновить корабли после попадания
  static async updateShipsAfterHit(
    gameId: string,
    ships: any,
    isCreator: boolean
  ): Promise<void> {
    const field = isCreator ? 'creator_ships' : 'opponent_ships';

    await supabase
      .from('games')
      .update({ [field]: ships })
      .eq('id', gameId);
  }
}

// Сервис для работы с попытками
export class GuessService {
  // Добавить попытку
  static async addGuess(
    gameId: string,
    playerId: string,
    guess: string,
    result: string,
    matchesCount: number
  ): Promise<Guess | null> {
    const { data, error } = await supabase
      .from('guesses')
      .insert([{
        game_id: gameId,
        player_id: playerId,
        guess,
        result,
        matches_count: matchesCount
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding guess:', error);
      return null;
    }

    return data;
  }

  // Получить историю попыток для игры
  static async getGameGuesses(gameId: string): Promise<Guess[]> {
    const { data, error } = await supabase
      .from('guesses')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching guesses:', error);
      return [];
    }

    return data || [];
  }

  // Подписаться на новые попытки
  static subscribeToGuesses(gameId: string, callback: (guess: Guess) => void): RealtimeChannel {
    return supabase
      .channel(`guesses-${gameId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'guesses',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        callback(payload.new as Guess);
      })
      .subscribe();
  }
}

// Сервис для работы с приглашениями
export class InvitationService {
  // Отправить приглашение
  static async sendInvitation(
    gameId: string,
    fromPlayerId: string,
    toPlayerId: string
  ): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .insert([{
        game_id: gameId,
        from_player_id: fromPlayerId,
        to_player_id: toPlayerId,
        status: 'PENDING'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending invitation:', error);
      return null;
    }

    return data;
  }

  // Получить приглашения игрока
  static async getPlayerInvitations(playerId: string): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('to_player_id', playerId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }

    return data || [];
  }

  // Принять приглашение
  static async acceptInvitation(invitationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'ACCEPTED' })
      .eq('id', invitationId);

    return !error;
  }

  // Отклонить приглашение
  static async rejectInvitation(invitationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'REJECTED' })
      .eq('id', invitationId);

    return !error;
  }
}

// Утилита для периодического обновления онлайн статуса
export function startHeartbeat(playerId: string, intervalMs: number = 30000): () => void {
  const interval = setInterval(() => {
    PlayerService.updateOnlineStatus(playerId, true);
  }, intervalMs);

  return () => clearInterval(interval);
}
