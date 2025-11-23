// Telegram WebApp Integration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export class TelegramService {
  private static instance: TelegramService;
  private tg: typeof window.Telegram.WebApp | null = null;

  private constructor() {
    if (window.Telegram?.WebApp) {
      this.tg = window.Telegram.WebApp;
      this.tg.ready();
      this.tg.expand();
    }
  }

  static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  isAvailable(): boolean {
    return this.tg !== null;
  }

  getUser(): TelegramUser | null {
    if (!this.tg?.initDataUnsafe?.user) {
      return null;
    }
    return this.tg.initDataUnsafe.user;
  }

  getUserDisplayName(): string {
    const user = this.getUser();
    if (!user) return 'Аноним';

    if (user.username) return user.username;
    if (user.first_name) {
      return user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name;
    }
    return 'Игрок';
  }

  getUserAvatar(): string | null {
    const user = this.getUser();
    return user?.photo_url || null;
  }

  getUserId(): number | null {
    const user = this.getUser();
    return user?.id || null;
  }

  close(): void {
    this.tg?.close();
  }

  showMainButton(text: string, onClick: () => void): void {
    if (this.tg?.MainButton) {
      this.tg.MainButton.setText(text);
      this.tg.MainButton.onClick(onClick);
      this.tg.MainButton.show();
    }
  }

  hideMainButton(): void {
    this.tg?.MainButton?.hide();
  }

  hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection'): void {
    if (!this.tg?.HapticFeedback) return;

    if (type === 'selection') {
      this.tg.HapticFeedback.selectionChanged();
    } else if (type === 'success' || type === 'error' || type === 'warning') {
      this.tg.HapticFeedback.notificationOccurred(type);
    } else {
      this.tg.HapticFeedback.impactOccurred(type);
    }
  }

  getThemeParams() {
    return this.tg?.themeParams || {};
  }
}

export const telegramService = TelegramService.getInstance();
