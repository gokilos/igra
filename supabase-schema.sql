-- Создание таблиц для игры "Сибирский Кальмар"
-- Используйте этот скрипт в вашей Supabase Dashboard > SQL Editor

-- 1. Таблица игроков (онлайн пользователи без регистрации)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL CHECK (avatar IN ('○', '△', '□')),
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Таблица игр
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES players(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('NUMBERS', 'WORDS')),
  status TEXT NOT NULL CHECK (status IN ('WAITING', 'SETUP', 'PLAYING', 'FINISHED')) DEFAULT 'WAITING',
  prize TEXT, -- Приз за победу
  creator_secret TEXT, -- Загаданное число/слово создателя
  opponent_secret TEXT, -- Загаданное число/слово оппонента
  creator_revealed_indices BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[], -- Открытые индексы создателя
  opponent_revealed_indices BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[], -- Открытые индексы оппонента
  current_turn UUID, -- ID игрока, чей сейчас ход
  winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  turn_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица попыток отгадывания (история)
CREATE TABLE IF NOT EXISTS guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  guess TEXT NOT NULL,
  result TEXT NOT NULL, -- "ВЕРНО!", "ОТКРЫТО: 2", "НЕТ СОВПАДЕНИЙ"
  matches_count INTEGER DEFAULT 0, -- Количество совпадений по позициям
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_players_online ON players(is_online, last_seen);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_creator ON games(creator_id);
CREATE INDEX IF NOT EXISTS idx_games_opponent ON games(opponent_id);
CREATE INDEX IF NOT EXISTS idx_guesses_game ON guesses(game_id, created_at);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для обновления updated_at в таблице games
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для очистки неактивных игроков (старше 5 минут)
CREATE OR REPLACE FUNCTION cleanup_inactive_players()
RETURNS void AS $$
BEGIN
    UPDATE players
    SET is_online = false
    WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ language 'plpgsql';

-- Включение Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;

-- Политики доступа (разрешаем всем читать и писать для простоты)
CREATE POLICY "Все могут читать игроков" ON players FOR SELECT USING (true);
CREATE POLICY "Все могут создавать игроков" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Все могут обновлять игроков" ON players FOR UPDATE USING (true);

CREATE POLICY "Все могут читать игры" ON games FOR SELECT USING (true);
CREATE POLICY "Все могут создавать игры" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Все могут обновлять игры" ON games FOR UPDATE USING (true);

CREATE POLICY "Все могут читать попытки" ON guesses FOR SELECT USING (true);
CREATE POLICY "Все могут создавать попытки" ON guesses FOR INSERT WITH CHECK (true);

-- Представление для активных игр в лобби
CREATE OR REPLACE VIEW lobby_games AS
SELECT
  g.id,
  g.game_mode,
  g.prize,
  g.status,
  p.nickname as creator_nickname,
  p.avatar as creator_avatar,
  g.created_at
FROM games g
JOIN players p ON g.creator_id = p.id
WHERE g.status = 'WAITING'
ORDER BY g.created_at DESC;

-- Функция для подсчета онлайн игроков
CREATE OR REPLACE FUNCTION count_online_players()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM players WHERE is_online = true AND last_seen > NOW() - INTERVAL '2 minutes');
END;
$$ language 'plpgsql';

-- Тестовые данные (опционально)
-- INSERT INTO players (nickname, avatar) VALUES
-- ('ИГРОК-123', '○'),
-- ('ИГРОК-456', '△'),
-- ('ИГРОК-789', '□');
