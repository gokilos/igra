#!/usr/bin/env python3
"""
Telegram бот для игры "Быки и Коровы"
Поддерживает систему приглашений и интеграцию с WebApp
"""

import os
from dotenv import load_dotenv
import logging
from datetime import datetime
from typing import Optional
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from supabase import create_client, Client

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, '.env'))

# Константы
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не задан в переменных окружения (.env)")
if not WEBAPP_URL:
    raise RuntimeError("WEBAPP_URL не задан в переменных окружения (.env)")
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("SUPABASE_URL/SUPABASE_KEY не заданы — функции БД будут недоступны")

# Инициализация Supabase клиента
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    user = update.effective_user

    # Регистрация/обновление пользователя в БД
    if supabase:
        try:
            # Проверяем, существует ли пользователь
            result = supabase.table('players').select('*').eq('telegram_id', user.id).execute()

            if not result.data:
                # Создаем нового пользователя
                supabase.table('players').insert({
                    'telegram_id': user.id,
                    'telegram_username': user.username,
                    'telegram_first_name': user.first_name,
                    'telegram_last_name': user.last_name,
                    'login': user.username or f"user_{user.id}",
                    'nickname': user.first_name or user.username or f"Игрок {user.id}",
                    'avatar': '○',
                    'is_online': True,
                }).execute()
                logger.info(f"Создан новый пользователь: {user.id}")
            else:
                # Обновляем данные существующего пользователя
                supabase.table('players').update({
                    'telegram_username': user.username,
                    'telegram_first_name': user.first_name,
                    'telegram_last_name': user.last_name,
                    'is_online': True,
                    'last_seen': datetime.now().isoformat(),
                }).eq('telegram_id', user.id).execute()
                logger.info(f"Обновлен пользователь: {user.id}")
        except Exception as e:
            logger.error(f"Ошибка при работе с БД: {e}")

    # Создаем клавиатуру
    keyboard = [
        [InlineKeyboardButton("🎮 Играть", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton("👥 Участники", callback_data='participants')],
        [InlineKeyboardButton("📨 Мои приглашения", callback_data='my_invitations')],
        [InlineKeyboardButton("ℹ️ Помощь", callback_data='help')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    welcome_text = f"""
👋 Привет, {user.first_name}!

Добро пожаловать в игру <b>"Быки и Коровы"</b>!

🎯 Это интеллектуальная игра, где нужно угадать число или слово противника.

Что умеет этот бот:
• 🎮 Запуск игры
• 👥 Просмотр онлайн участников
• 📨 Приглашения других игроков
• 🔔 Уведомления о приглашениях

Нажмите "Играть" чтобы начать!
"""

    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode='HTML'
    )


async def participants(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать список участников"""
    query = update.callback_query
    await query.answer()

    if not supabase:
        await query.message.reply_text("❌ База данных недоступна")
        return

    try:
        # Получаем онлайн игроков
        result = supabase.table('players')\
            .select('id, login, telegram_username, telegram_first_name, is_online')\
            .eq('is_online', True)\
            .order('last_seen', desc=True)\
            .limit(50)\
            .execute()

        if not result.data:
            await query.message.reply_text("Нет онлайн участников")
            return

        # Формируем список участников
        text = "👥 <b>Онлайн участники:</b>\n\n"
        keyboard = []

        for idx, player in enumerate(result.data, 1):
            name = player.get('telegram_first_name') or player.get('login') or 'Игрок'
            username = f"@{player['telegram_username']}" if player.get('telegram_username') else ''
            status = "🟢" if player.get('is_online') else "⚪"

            text += f"{idx}. {status} {name} {username}\n"

            # Добавляем кнопку для приглашения (по 2 в ряд)
            if idx <= 10:  # Ограничиваем до 10 кнопок
                keyboard.append(
                    InlineKeyboardButton(
                        f"✉️ {name}",
                        callback_data=f'invite_{player["id"]}'
                    )
                )

        # Группируем кнопки по 2 в ряд
        keyboard_rows = [keyboard[i:i+2] for i in range(0, len(keyboard), 2)]
        keyboard_rows.append([InlineKeyboardButton("◀️ Назад", callback_data='back_to_menu')])

        reply_markup = InlineKeyboardMarkup(keyboard_rows)

        await query.message.edit_text(
            text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
    except Exception as e:
        logger.error(f"Ошибка при получении участников: {e}")
        await query.message.reply_text("❌ Ошибка при загрузке участников")


async def my_invitations(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать приглашения пользователя"""
    query = update.callback_query
    await query.answer()
    user = update.effective_user

    if not supabase:
        await query.message.reply_text("❌ База данных недоступна")
        return

    try:
        # Получаем player_id по telegram_id
        player_result = supabase.table('players')\
            .select('id')\
            .eq('telegram_id', user.id)\
            .single()\
            .execute()

        if not player_result.data:
            await query.message.reply_text("❌ Пользователь не найден")
            return

        player_id = player_result.data['id']

        # Получаем приглашения
        result = supabase.rpc('get_player_invitations', {'player_id': player_id}).execute()

        if not result.data:
            await query.message.reply_text(
                "📭 У вас нет активных приглашений",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Назад", callback_data='back_to_menu')
                ]])
            )
            return

        text = "📨 <b>Ваши приглашения:</b>\n\n"
        keyboard = []

        for idx, inv in enumerate(result.data, 1):
            from_player = inv['from_player_login']
            game_name = inv.get('game_name') or 'Игра'

            text += f"{idx}. 🎮 {game_name}\n"
            text += f"   от: {from_player}\n\n"

            keyboard.append([
                InlineKeyboardButton(
                    f"✅ Принять #{idx}",
                    callback_data=f'accept_{inv["invitation_id"]}'
                ),
                InlineKeyboardButton(
                    f"❌ Отклонить #{idx}",
                    callback_data=f'reject_{inv["invitation_id"]}'
                )
            ])

        keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data='back_to_menu')])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await query.message.edit_text(
            text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
    except Exception as e:
        logger.error(f"Ошибка при получении приглашений: {e}")
        await query.message.reply_text("❌ Ошибка при загрузке приглашений")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать помощь"""
    query = update.callback_query

    help_text = """
ℹ️ <b>Помощь по игре "Быки и Коровы"</b>

<b>Правила игры:</b>

<b>Цифры/Слова:</b>
1️⃣ Каждый игрок загадывает число (4 цифры) или слово (5 букв)
2️⃣ Игроки по очереди пытаются угадать загаданное
3️⃣ За каждую правильную цифру/букву на правильной позиции открывается символ
4️⃣ Побеждает тот, кто первым угадает полностью!

<b>Морской бой:</b>
1️⃣ Расставьте 5 кораблей на поле 10x10
2️⃣ По очереди стреляйте по полю противника
3️⃣ Цель - потопить все корабли противника
4️⃣ Побеждает тот, кто первым потопит все корабли!

<b>Команды бота:</b>
/start - Главное меню
/participants - Список участников
/help - Эта справка

<b>Как играть:</b>
1. Нажмите "🎮 Играть"
2. Создайте игру или присоединитесь к существующей
3. Пригласите друзей через бота или отправьте им ссылку

Удачи! 🍀
"""

    keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data='back_to_menu')]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    if query:
        await query.answer()
        await query.message.edit_text(
            help_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
    else:
        await update.message.reply_text(
            help_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик нажатий на кнопки"""
    query = update.callback_query
    data = query.data

    if data == 'participants':
        await participants(update, context)
    elif data == 'my_invitations':
        await my_invitations(update, context)
    elif data == 'help':
        await help_command(update, context)
    elif data == 'back_to_menu':
        await back_to_menu(update, context)
    elif data.startswith('invite_'):
        await send_invitation(update, context)
    elif data.startswith('accept_'):
        await accept_invitation(update, context)
    elif data.startswith('reject_'):
        await reject_invitation(update, context)


async def send_invitation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Отправить приглашение игроку"""
    query = update.callback_query
    await query.answer("Функция приглашения будет доступна через WebApp")


async def accept_invitation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Принять приглашение"""
    query = update.callback_query
    invitation_id = query.data.split('_')[1]

    if not supabase:
        await query.answer("❌ База данных недоступна", show_alert=True)
        return

    try:
        # Обновляем статус приглашения
        supabase.table('invitations').update({
            'status': 'ACCEPTED',
            'updated_at': datetime.now().isoformat()
        }).eq('id', invitation_id).execute()

        await query.answer("✅ Приглашение принято!", show_alert=True)
        await my_invitations(update, context)
    except Exception as e:
        logger.error(f"Ошибка при принятии приглашения: {e}")
        await query.answer("❌ Ошибка", show_alert=True)


async def reject_invitation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Отклонить приглашение"""
    query = update.callback_query
    invitation_id = query.data.split('_')[1]

    if not supabase:
        await query.answer("❌ База данных недоступна", show_alert=True)
        return

    try:
        # Обновляем статус приглашения
        supabase.table('invitations').update({
            'status': 'REJECTED',
            'updated_at': datetime.now().isoformat()
        }).eq('id', invitation_id).execute()

        await query.answer("❌ Приглашение отклонено", show_alert=True)
        await my_invitations(update, context)
    except Exception as e:
        logger.error(f"Ошибка при отклонении приглашения: {e}")
        await query.answer("❌ Ошибка", show_alert=True)


async def back_to_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Вернуться в главное меню"""
    query = update.callback_query
    await query.answer()

    keyboard = [
        [InlineKeyboardButton("🎮 Играть", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton("👥 Участники", callback_data='participants')],
        [InlineKeyboardButton("📨 Мои приглашения", callback_data='my_invitations')],
        [InlineKeyboardButton("ℹ️ Помощь", callback_data='help')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.message.edit_text(
        "🎮 <b>Главное меню</b>\n\nВыберите действие:",
        reply_markup=reply_markup,
        parse_mode='HTML'
    )


async def participants_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Команда /participants"""
    # Создаем фейковый callback query для переиспользования логики
    update.callback_query = type('obj', (object,), {
        'answer': lambda: None,
        'message': update.message
    })()
    await participants(update, context)


def main() -> None:
    """Запуск бота"""
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()

    # Регистрируем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("participants", participants_command))
    application.add_handler(CallbackQueryHandler(button_handler))

    # Запускаем бота
    logger.info("Бот запущен!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
