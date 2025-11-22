// Утилита для работы с виброоткликом в Telegram WebApp

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export const haptic = {
  // Легкая вибрация (нажатие кнопки)
  light: () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  // Средняя вибрация (подтверждение действия)
  medium: () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  // Сильная вибрация (важное событие)
  heavy: () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  // Уведомление об успехе
  success: () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  // Уведомление об ошибке
  error: () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },

  // Изменение выбора
  selection: () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  },
};
