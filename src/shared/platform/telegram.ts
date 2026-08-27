import type { ColorScheme, InvoiceStatus, Platform, SystemButton } from './types';

/** Минимальное описание того, чем мы реально пользуемся из Telegram WebApp. */
interface TgButton {
  setText(text: string): void;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TgWebApp {
  initData: string;
  colorScheme: ColorScheme;
  themeParams: Record<string, string>;
  BackButton: TgButton;
  MainButton: TgButton;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'success' | 'error' | 'warning'): void;
  };
  ready(): void;
  expand(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openInvoice(url: string, callback: (status: InvoiceStatus) => void): void;
  onEvent(event: string, handler: () => void): void;
  offEvent(event: string, handler: () => void): void;
}

export function getTelegramWebApp(): TgWebApp | null {
  const tg = (window as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return tg ?? null;
}

/**
 * Признак мини-аппа — непустой initData, а не наличие объекта WebApp.
 *
 * Во встроенном браузере Telegram (человек тапнул обычную ссылку в чате) объект
 * существует, но initData пустой. Проверка на объект отправила бы такого
 * посетителя в оболочку мини-аппа без авторизации.
 */
export function isTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();
  return Boolean(tg?.initData);
}

function wrapButton(button: TgButton): SystemButton {
  let current: (() => void) | null = null;

  return {
    show(text, onClick) {
      if (current) button.offClick(current);
      current = onClick;
      button.setText(text);
      button.onClick(onClick);
      button.show();
    },
    hide() {
      if (current) {
        button.offClick(current);
        current = null;
      }
      button.hide();
    },
  };
}

export function createTelegramPlatform(tg: TgWebApp): Platform {
  return {
    name: 'telegram',

    getInitData: () => tg.initData || null,

    getColorScheme: () => tg.colorScheme,

    onColorSchemeChange(handler) {
      const listener = () => handler(tg.colorScheme);
      tg.onEvent('themeChanged', listener);
      return () => tg.offEvent('themeChanged', listener);
    },

    openLink: (url) => tg.openLink(url),

    openInvoice: (url) =>
      new Promise<InvoiceStatus>((resolve) => {
        tg.openInvoice(url, resolve);
      }),

    haptic(kind) {
      const h = tg.HapticFeedback;
      if (!h) return;
      if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
      else h.impactOccurred(kind);
    },

    backButton: wrapButton(tg.BackButton),
    mainButton: wrapButton(tg.MainButton),

    ready() {
      tg.ready();
      tg.expand();
    },
  };
}
