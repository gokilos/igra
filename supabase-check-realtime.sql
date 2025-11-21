-- Проверка и настройка Realtime для Supabase
-- Выполните эти команды в Supabase SQL Editor

-- 1. Включить Realtime для таблиц (если еще не включено)
-- Это нужно сделать через Dashboard:
-- Database → Replication → Enable для tables: players, games, guesses

-- 2. Проверить публикацию
SELECT * FROM pg_publication;

-- 3. Убедиться что таблицы добавлены в репликацию
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 4. Если таблицы не в репликации, добавить их:
-- (Это обычно делается через Dashboard, но можно и через SQL)

-- Альтернативный способ через Dashboard:
-- 1. Перейдите в Database → Publications
-- 2. Найдите publication "supabase_realtime"
-- 3. Убедитесь что включены таблицы: players, games, guesses
-- 4. Если нет - добавьте их

-- 5. Проверить что Row Level Security не блокирует Realtime
-- Политики уже настроены в supabase-schema.sql, проверим что они работают:

-- Для players
SELECT * FROM pg_policies WHERE tablename = 'players';

-- Для games
SELECT * FROM pg_policies WHERE tablename = 'games';

-- Для guesses
SELECT * FROM pg_policies WHERE tablename = 'guesses';

-- ВАЖНО: В Supabase Dashboard также нужно:
-- 1. Settings → API → Enable Realtime
-- 2. Database → Replication → включить для каждой таблицы (players, games, guesses)
