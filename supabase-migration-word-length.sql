-- Миграция: Добавление поля word_length для настройки длины слова
-- Выполните этот скрипт в Supabase SQL Editor

-- Добавить поле word_length в таблицу games
ALTER TABLE games
ADD COLUMN IF NOT EXISTS word_length INTEGER DEFAULT 5 CHECK (word_length IN (5, 6, 10));

-- Добавить комментарий
COMMENT ON COLUMN games.word_length IS 'Длина слова для режима WORDS (5, 6 или 10 букв)';

-- Обновить существующие игры
UPDATE games
SET word_length = 5
WHERE game_mode = 'WORDS' AND word_length IS NULL;
