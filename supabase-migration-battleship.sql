-- Миграция для добавления поддержки игры "Морской бой"
-- Добавляет новые поля к существующей таблице games без изменения текущих данных

-- 1. Обновление game_mode для поддержки BATTLESHIP
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_mode_check;
ALTER TABLE games ADD CONSTRAINT games_game_mode_check
  CHECK (game_mode IN ('NUMBERS', 'WORDS', 'BATTLESHIP'));

-- 2. Добавление полей для хранения кораблей и выстрелов
-- Используем JSONB для гибкости и производительности
ALTER TABLE games
ADD COLUMN IF NOT EXISTS creator_ships JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS opponent_ships JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS creator_hits JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS opponent_hits JSONB DEFAULT '[]'::JSONB;

-- 3. Добавление поля для хранения названия игры (если еще нет)
ALTER TABLE games
ADD COLUMN IF NOT EXISTS game_name TEXT;

COMMENT ON COLUMN games.creator_ships IS 'Корабли создателя игры в формате: [{"type": "carrier", "length": 5, "cells": [[0,0], [0,1], ...], "hits": 0}]';
COMMENT ON COLUMN games.opponent_ships IS 'Корабли оппонента в формате: [{"type": "carrier", "length": 5, "cells": [[0,0], [0,1], ...], "hits": 0}]';
COMMENT ON COLUMN games.creator_hits IS 'Выстрелы создателя в формате: [{"cell": [3,4], "result": "hit"|"miss"|"sunk"}]';
COMMENT ON COLUMN games.opponent_hits IS 'Выстрелы оппонента в формате: [{"cell": [3,4], "result": "hit"|"miss"|"sunk"}]';

-- 4. Индексы для оптимизации запросов JSONB
CREATE INDEX IF NOT EXISTS idx_games_mode_battleship ON games(game_mode) WHERE game_mode = 'BATTLESHIP';

-- 5. Создание функции для проверки валидности расстановки кораблей
CREATE OR REPLACE FUNCTION validate_battleship_ships(ships JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  ship JSONB;
  cell_count INTEGER := 0;
BEGIN
  -- Проверяем, что у нас есть корабли
  IF ships IS NULL OR jsonb_array_length(ships) = 0 THEN
    RETURN FALSE;
  END IF;

  -- Проверяем количество кораблей (должно быть 5: авианосец, линкор, крейсер, эсминец, подлодка)
  IF jsonb_array_length(ships) != 5 THEN
    RETURN FALSE;
  END IF;

  -- Подсчитываем общее количество клеток (должно быть 17: 5+4+3+3+2)
  FOR ship IN SELECT * FROM jsonb_array_elements(ships)
  LOOP
    cell_count := cell_count + jsonb_array_length(ship->'cells');
  END LOOP;

  IF cell_count != 17 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. Создание функции для проверки победы в морском бое
CREATE OR REPLACE FUNCTION check_battleship_winner(game_id UUID)
RETURNS UUID AS $$
DECLARE
  game_record RECORD;
  creator_sunk INTEGER := 0;
  opponent_sunk INTEGER := 0;
  ship JSONB;
BEGIN
  -- Получаем игру
  SELECT * INTO game_record FROM games WHERE id = game_id;

  IF NOT FOUND OR game_record.game_mode != 'BATTLESHIP' THEN
    RETURN NULL;
  END IF;

  -- Проверяем потопленные корабли создателя (цель оппонента)
  IF game_record.creator_ships IS NOT NULL THEN
    FOR ship IN SELECT * FROM jsonb_array_elements(game_record.creator_ships)
    LOOP
      IF (ship->>'hits')::INTEGER >= (ship->>'length')::INTEGER THEN
        creator_sunk := creator_sunk + 1;
      END IF;
    END LOOP;
  END IF;

  -- Проверяем потопленные корабли оппонента (цель создателя)
  IF game_record.opponent_ships IS NOT NULL THEN
    FOR ship IN SELECT * FROM jsonb_array_elements(game_record.opponent_ships)
    LOOP
      IF (ship->>'hits')::INTEGER >= (ship->>'length')::INTEGER THEN
        opponent_sunk := opponent_sunk + 1;
      END IF;
    END LOOP;
  END IF;

  -- Если все корабли создателя потоплены - победил оппонент
  IF creator_sunk >= 5 THEN
    RETURN game_record.opponent_id;
  END IF;

  -- Если все корабли оппонента потоплены - победил создатель
  IF opponent_sunk >= 5 THEN
    RETURN game_record.creator_id;
  END IF;

  -- Еще нет победителя
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Обновление представления lobby_games для включения морского боя
DROP VIEW IF EXISTS lobby_games;
CREATE OR REPLACE VIEW lobby_games AS
SELECT
  g.id,
  g.game_mode,
  g.game_name,
  g.prize,
  g.status,
  p.nickname as creator_nickname,
  p.login as creator_login,
  p.avatar as creator_avatar,
  g.created_at,
  g.word_length
FROM games g
JOIN players p ON g.creator_id = p.id
WHERE g.status = 'WAITING'
ORDER BY g.created_at DESC;

-- 8. Комментарии для документации
COMMENT ON TABLE games IS 'Таблица игр: поддерживает режимы NUMBERS, WORDS и BATTLESHIP';
