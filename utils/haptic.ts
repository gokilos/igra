// Утилита для работы с виброоткликом в Telegram WebApp
// Документация: https://core.telegram.org/bots/webapps#hapticfeedback

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready?: () => void;
      };
    };
  }
}

// Проверяем доступность Telegram WebApp
const isTelegramAvailable = () => {
  return typeof window !== 'undefined' &&
         window.Telegram?.WebApp?.HapticFeedback;
};

export const haptic = {
  // Легкая вибрация (нажатие на кнопку)
  light: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.impactOccurred('light');
    }
  },

  // Средняя вибрация (подтверждение действия)
  medium: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.impactOccurred('medium');
    }
  },

  // Сильная вибрация (важное событие)
  heavy: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.impactOccurred('heavy');
    }
  },

  // Мягкая вибрация
  soft: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.impactOccurred('soft');
    }
  },

  // Жесткая вибрация
  rigid: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.impactOccurred('rigid');
    }
  },

  // Уведомление об успехе
  success: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.notificationOccurred('success');
    }
  },

  // Уведомление об ошибке
  error: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.notificationOccurred('error');
    }
  },

  // Предупреждение
  warning: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.notificationOccurred('warning');
    }
  },

  // Изменение выбора (для переключателей, слайдеров)
  selection: () => {
    if (isTelegramAvailable()) {
      window.Telegram!.WebApp!.HapticFeedback!.selectionChanged();
    }
  },
};

// Инициализация Telegram WebApp при загрузке
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready?.();
  console.log('Telegram WebApp initialized');
}
