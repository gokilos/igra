#!/usr/bin/env python3
"""
Слушатель приглашений - отправляет уведомления при новых приглашениях
Работает как отдельный процесс вместе с основным ботом
"""

import os
import asyncio
import logging
from datetime import datetime
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Константы
BOT_TOKEN = os.getenv("BOT_TOKEN", "8131071089:AAEf_oNUIDV-HGYzptZ5ZAiWSHyriA9co3s")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-webapp-url.com")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Инициализация
bot = Bot(token=BOT_TOKEN)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Кэш обработанных приглашений
processed_invitations = set()


async def send_invitation_notification(invitation: dict) -> bool:
    """Отправить уведомление о приглашении"""
    try:
        invitation_id = invitation['id']

        # Проверяем что уже не обработали
        if invitation_id in processed_invitations:
            return True

        # Получаем данные отправителя
        from_player = supabase.table('players')\
            .select('*')\
            .eq('id', invitation['from_player_id'])\
            .single()\
            .execute()

        if not from_player.data:
            logger.error(f"Отправитель не найден: {invitation['from_player_id']}")
            return False

        # Получаем данные получателя
        to_player = supabase.table('players')\
            .select('*')\
            .eq('id', invitation['to_player_id'])\
            .single()\
            .execute()

        if not to_player.data or not to_player.data.get('telegram_id'):
            logger.error(f"Получатель не найден или нет telegram_id: {invitation['to_player_id']}")
            return False

        # Получаем данные игры
        game = supabase.table('games')\
            .select('*')\
            .eq('id', invitation['game_id'])\
            .single()\
            .execute()

        if not game.data:
            logger.error(f"Игра не найдена: {invitation['game_id']}")
            return False

        # Формируем сообщение
        from_name = from_player.data.get('telegram_first_name') or from_player.data.get('login') or 'Игрок'
        game_name = game.data.get('game_name') or 'Игра'
        game_mode_text = '🔢 Цифры' if game.data.get('game_mode') == 'NUMBERS' else '📝 Слова'
        prize_text = f"\n🏆 Приз: {game.data.get('prize')}" if game.data.get('prize') else ''

        message_text = f"""
🎮 <b>Новое приглашение в игру!</b>

👤 <b>{from_name}</b> приглашает вас в игру

📋 Название: <b>{game_name}</b>
🎯 Режим: {game_mode_text}{prize_text}

Нажмите кнопку ниже чтобы присоединиться!
"""

        # Создаем кнопки с WebApp
        game_url = f"{WEBAPP_URL}?startapp=game_{game.data['id']}"
        keyboard = [
            [InlineKeyboardButton("✅ Вступить в игру", web_app=WebAppInfo(url=game_url))],
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

        # Добавляем в обработанные
        processed_invitations.add(invitation_id)
        logger.info(f"✅ Уведомление отправлено: telegram_id={to_player.data['telegram_id']}, game={game_name}")

        return True

    except Exception as e:
        logger.error(f"❌ Ошибка при отправке уведомления: {e}")
        return False


async def check_new_invitations():
    """Проверить новые приглашения каждые N секунд"""
    logger.info("🔄 Запуск слушателя приглашений...")

    while True:
        try:
            # Получаем все PENDING приглашения
            result = supabase.table('invitations')\
                .select('*')\
                .eq('status', 'PENDING')\
                .execute()

            if result.data:
                for invitation in result.data:
                    await send_invitation_notification(invitation)

            # Очищаем кэш старых приглашений (старше 1 часа)
            if len(processed_invitations) > 1000:
                processed_invitations.clear()
                logger.info("🗑️ Очищен кэш приглашений")

        except Exception as e:
            logger.error(f"❌ Ошибка при проверке приглашений: {e}")

        # Проверяем каждые 3 секунды
        await asyncio.sleep(3)


def main():
    """Запуск слушателя"""
    if not supabase:
        logger.error("❌ Supabase не настроен! Проверьте .env файл")
        return

    logger.info("🚀 Слушатель приглашений запущен")
    logger.info(f"📡 WEBAPP_URL: {WEBAPP_URL}")

    try:
        asyncio.run(check_new_invitations())
    except KeyboardInterrupt:
        logger.info("⏹️  Слушатель остановлен")


if __name__ == '__main__':
    main()
