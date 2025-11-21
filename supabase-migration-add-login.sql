-- Миграция: Добавление поля login для пользовательских логинов
-- Выполните этот скрипт в Supabase SQL Editor ПОСЛЕ выполнения supabase-schema.sql

-- 1. Добавить поле login (nullable сначала, чтобы не сломать существующие записи)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS login TEXT;

-- 2. Создать уникальный индекс для login (игнорируя NULL значения)
CREATE UNIQUE INDEX IF NOT EXISTS players_login_unique
ON players (login)
WHERE login IS NOT NULL;

-- 3. Удалить все тестовые/фейковые записи игроков
-- (Это удалит всех игроков со статусом offline или созданных системой)
DELETE FROM players
WHERE nickname LIKE 'ИГРОК-%' OR is_online = false;

-- 4. Очистить связанные игры без игроков
DELETE FROM games
WHERE creator_id NOT IN (SELECT id FROM players)
   OR (opponent_id IS NOT NULL AND opponent_id NOT IN (SELECT id FROM players));

-- 5. Очистить попытки без игр
DELETE FROM guesses
WHERE game_id NOT IN (SELECT id FROM games);

-- 6. Добавить комментарии для документации
COMMENT ON COLUMN players.login IS 'Уникальный логин пользователя, выбранный при регистрации';
COMMENT ON COLUMN players.nickname IS 'Отображаемое имя игрока (может совпадать с login)';

-- 7. Создать функцию для проверки доступности логина
CREATE OR REPLACE FUNCTION is_login_available(check_login TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM players WHERE LOWER(login) = LOWER(check_login)
    );
END;
$$ LANGUAGE plpgsql;

-- Готово! Теперь таблица готова для работы с пользовательскими логинами
-- Все тестовые данные удалены, в системе будут только реальные игроки
