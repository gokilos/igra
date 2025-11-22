-- Миграция: Добавление системы приглашений и Telegram интеграции
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Добавить поля для Telegram интеграции в таблицу players
ALTER TABLE players
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_first_name TEXT,
ADD COLUMN IF NOT EXISTS telegram_last_name TEXT,
ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;

-- 2. Добавить поле game_name в таблицу games для поиска игр по названию
ALTER TABLE games
ADD COLUMN IF NOT EXISTS game_name TEXT;

-- Создать индекс для быстрого поиска по названию игры
CREATE INDEX IF NOT EXISTS idx_games_name ON games(game_name);

-- 3. Создать таблицу для приглашений
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  from_player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  to_player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска приглашений
CREATE INDEX IF NOT EXISTS idx_invitations_to_player ON invitations(to_player_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_game ON invitations(game_id);
CREATE INDEX IF NOT EXISTS idx_invitations_from_player ON invitations(from_player_id);

-- 4. Добавить триггер для обновления updated_at в invitations
DROP TRIGGER IF EXISTS update_invitations_updated_at ON invitations;
CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Включить RLS для invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Политики доступа для invitations
CREATE POLICY "Все могут читать приглашения" ON invitations FOR SELECT USING (true);
CREATE POLICY "Все могут создавать приглашения" ON invitations FOR INSERT WITH CHECK (true);
CREATE POLICY "Все могут обновлять приглашения" ON invitations FOR UPDATE USING (true);

-- 6. Создать функцию для получения активных приглашений игрока
CREATE OR REPLACE FUNCTION get_player_invitations(player_id UUID)
RETURNS TABLE (
  invitation_id UUID,
  game_id UUID,
  game_name TEXT,
  from_player_login TEXT,
  from_player_telegram_username TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id as invitation_id,
    i.game_id,
    g.game_name,
    p.login as from_player_login,
    p.telegram_username as from_player_telegram_username,
    i.status,
    i.created_at
  FROM invitations i
  JOIN games g ON i.game_id = g.id
  JOIN players p ON i.from_player_id = p.id
  WHERE i.to_player_id = player_id
    AND i.status = 'PENDING'
  ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Создать функцию для автоматической очистки старых приглашений (старше 24 часов)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE invitations
  SET status = 'EXPIRED'
  WHERE status = 'PENDING'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 8. Комментарии для документации
COMMENT ON COLUMN players.telegram_id IS 'Telegram User ID для интеграции с ботом';
COMMENT ON COLUMN players.telegram_username IS 'Telegram username игрока';
COMMENT ON COLUMN games.game_name IS 'Название игры для поиска и приглашений';
COMMENT ON TABLE invitations IS 'Таблица приглашений игроков в игры';

-- Готово! Теперь база данных готова для системы приглашений
