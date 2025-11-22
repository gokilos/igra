#!/usr/bin/env python3
"""
Webhook для отправки уведомлений о приглашениях
Используется WebApp для уведомления игроков через Telegram бота
"""

import os
import logging
from typing import Optional
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Константы
BOT_TOKEN = os.getenv("BOT_TOKEN", "8131071089:AAEf_oNUIDV-HGYzptZ5ZAiWSHyriA9co3s")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-webapp-url.com")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Инициализация
bot = Bot(token=BOT_TOKEN)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


async def send_game_invitation_notification(
    invitation_id: str,
    from_player_id: str,
    to_player_id: str,
    game_id: str
) -> bool:
    """
    Отправить уведомление о приглашении в игру

    Args:
        invitation_id: ID приглашения
        from_player_id: ID отправителя
        to_player_id: ID получателя
        game_id: ID игры

    Returns:
        True если уведомление отправлено успешно
    """
    if not supabase:
        logger.error("Supabase не настроен")
        return False

    try:
        # Получаем данные отправителя
        from_player = supabase.table('players')\
            .select('login, telegram_first_name, telegram_id')\
            .eq('id', from_player_id)\
            .single()\
            .execute()

        if not from_player.data:
            logger.error(f"Отправитель {from_player_id} не найден")
            return False

        # Получаем данные получателя
        to_player = supabase.table('players')\
            .select('telegram_id')\
            .eq('id', to_player_id)\
            .single()\
            .execute()

        if not to_player.data or not to_player.data.get('telegram_id'):
            logger.error(f"Получатель {to_player_id} не найден или нет telegram_id")
            return False

        # Получаем данные игры
        game = supabase.table('games')\
            .select('game_name, game_mode, prize')\
            .eq('id', game_id)\
            .single()\
            .execute()

        if not game.data:
            logger.error(f"Игра {game_id} не найдена")
            return False

        # Формируем сообщение
        from_name = from_player.data.get('telegram_first_name') or from_player.data.get('login') or 'Игрок'
        game_name = game.data.get('game_name') or 'Игра'
        game_mode = '🔢 Цифры' if game.data.get('game_mode') == 'NUMBERS' else '📝 Слова'
        prize_text = f"\n🏆 Приз: {game.data.get('prize')}" if game.data.get('prize') else ''

        message_text = f"""
🎮 <b>Приглашение в игру!</b>

👤 <b>{from_name}</b> приглашает вас в игру
📋 Название: <b>{game_name}</b>
🎯 Режим: {game_mode}{prize_text}

Примите приглашение и присоединяйтесь к игре!
"""

        # Создаем кнопки
        game_url = f"{WEBAPP_URL}?game_id={game_id}"
        keyboard = [
            [InlineKeyboardButton("✅ Вступить в игру", web_app={"url": game_url})],
            [InlineKeyboardButton("❌ Отклонить", callback_data=f'reject_{invitation_id}')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Отправляем уведомление
        await bot.send_message(
            chat_id=to_player.data['telegram_id'],
            text=message_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )

        logger.info(f"Уведомление отправлено: {to_player.data['telegram_id']}")
        return True

    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления: {e}")
        return False


# Для использования как модуль
if __name__ == "__main__":
    import asyncio

    # Пример использования
    async def test():
        success = await send_game_invitation_notification(
            invitation_id="test-invitation-id",
            from_player_id="test-from-player",
            to_player_id="test-to-player",
            game_id="test-game-id"
        )
        print(f"Результат: {success}")

    asyncio.run(test())
