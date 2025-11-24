-- Миграция для добавления системы рейтинга
-- Добавляет поля для отслеживания рейтинга, побед и поражений игроков

-- 1. Добавление полей рейтинга в таблицу players
ALTER TABLE players
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 1200,
ADD COLUMN IF NOT EXISTS games_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS games_draw INTEGER DEFAULT 0;

-- 2. Создание индекса для быстрого поиска по рейтингу
CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC);

-- 3. Функция для обновления рейтинга и статистики после завершения игры
CREATE OR REPLACE FUNCTION update_player_rating_after_game()
RETURNS TRIGGER AS $$
DECLARE
  winner_rating INTEGER;
  loser_rating INTEGER;
  rating_change INTEGER;
BEGIN
  -- Проверяем, что игра завершена и есть победитель
  IF NEW.status = 'FINISHED' AND NEW.winner_id IS NOT NULL THEN

    -- Получаем рейтинги игроков
    SELECT rating INTO winner_rating FROM players WHERE id = NEW.winner_id;

    -- Определяем проигравшего
    IF NEW.winner_id = NEW.creator_id THEN
      SELECT rating INTO loser_rating FROM players WHERE id = NEW.opponent_id;

      -- Обновляем статистику победителя (создатель)
      UPDATE players
      SET games_won = games_won + 1,
          rating = rating + GREATEST(10, LEAST(50, 25 + (loser_rating - winner_rating) / 20))
      WHERE id = NEW.winner_id;

      -- Обновляем статистику проигравшего (оппонент)
      UPDATE players
      SET games_lost = games_lost + 1,
          rating = GREATEST(0, rating - GREATEST(10, LEAST(50, 25 + (winner_rating - loser_rating) / 20)))
      WHERE id = NEW.opponent_id;

    ELSIF NEW.winner_id = NEW.opponent_id THEN
      SELECT rating INTO loser_rating FROM players WHERE id = NEW.creator_id;

      -- Обновляем статистику победителя (оппонент)
      UPDATE players
      SET games_won = games_won + 1,
          rating = rating + GREATEST(10, LEAST(50, 25 + (loser_rating - winner_rating) / 20))
      WHERE id = NEW.winner_id;

      -- Обновляем статистику проигравшего (создатель)
      UPDATE players
      SET games_lost = games_lost + 1,
          rating = GREATEST(0, rating - GREATEST(10, LEAST(50, 25 + (winner_rating - loser_rating) / 20)))
      WHERE id = NEW.creator_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Создание триггера для автоматического обновления рейтинга
DROP TRIGGER IF EXISTS update_rating_on_game_finish ON games;
CREATE TRIGGER update_rating_on_game_finish
  AFTER UPDATE ON games
  FOR EACH ROW
  WHEN (OLD.status != 'FINISHED' AND NEW.status = 'FINISHED')
  EXECUTE FUNCTION update_player_rating_after_game();

-- 5. Представление для таблицы лидеров
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.nickname,
  p.login,
  p.avatar,
  p.telegram_photo_url,
  p.rating,
  p.games_won,
  p.games_lost,
  p.games_draw,
  (p.games_won + p.games_lost + p.games_draw) as total_games,
  CASE
    WHEN (p.games_won + p.games_lost + p.games_draw) > 0
    THEN ROUND((p.games_won::DECIMAL / (p.games_won + p.games_lost + p.games_draw)) * 100, 2)
    ELSE 0
  END as win_rate
FROM players p
WHERE p.is_online = true OR (p.games_won + p.games_lost + p.games_draw) > 0
ORDER BY p.rating DESC, p.games_won DESC
LIMIT 100;

-- 6. Обновление существующих игроков (присваиваем начальный рейтинг, если NULL)
UPDATE players
SET rating = 1200
WHERE rating IS NULL;

UPDATE players
SET games_won = 0
WHERE games_won IS NULL;

UPDATE players
SET games_lost = 0
WHERE games_lost IS NULL;

UPDATE players
SET games_draw = 0
WHERE games_draw IS NULL;
