import type { BackButton, ColorScheme, InvoiceStatus, Platform, SystemButton } from './types';

/**
 * Минимальное описание того, чем мы реально пользуемся из Telegram WebApp.
 * BackButton и MainButton в реальном клиенте — разные объекты: у BackButton
 * нет setText (это просто стрелка назад), у MainButton есть.
 */
interface TgBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TgMainButton extends TgBackButton {
  setText(text: string): void;
}

interface TgWebApp {
  initData: string;
  colorScheme: ColorScheme;
  themeParams: Record<string, string>;
  BackButton: TgBackButton;
  MainButton: TgMainButton;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'success' | 'error' | 'warning'): void;
  };
  ready(): void;
  expand(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  /**
   * Bot API 6.1+. Принимает только хост t.me — на любом другом
   * telegram-web-app.js бросает WebAppTgUrlInvalid, поэтому зовётся строго
   * через openTelegramUrl() ниже.
   */
  openTelegramLink?(url: string): void;
  openInvoice(url: string, callback: (status: InvoiceStatus) => void): void;
  onEvent(event: string, handler: () => void): void;
  offEvent(event: string, handler: () => void): void;
  // Bot API 7.7+ — в старых клиентах методов нет, вызываем через optional chaining.
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
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

const TELEGRAM_LINK_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me']);

/**
 * Ссылку на Telegram надо открывать телеграмом, а не браузером.
 *
 * `openLink` уводит адрес в браузер (на телефоне — во встроенный браузер
 * Telegram), и для `t.me/...` это лишний прыжок: браузер открывается только
 * затем, чтобы тут же вернуть человека обратно в приложение. `openTelegramLink`
 * открывает канал, профиль или бота прямо внутри Telegram, и с Bot API 7.0
 * мини-апп при этом не закрывается.
 *
 * `telegram.me` переписывается в `t.me`: это его давний алиас, но
 * telegram-web-app.js сверяет хост буквально и на всём, кроме `t.me`, бросает.
 *
 * Возвращает null, если ссылка не телеграмная или разбор не удался — тогда
 * работает обычный openLink.
 */
function telegramLinkUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!TELEGRAM_LINK_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  parsed.hostname = 't.me';
  return parsed.toString();
}

function wrapBackButton(button: TgBackButton): BackButton {
  let current: (() => void) | null = null;

  return {
    show(onClick) {
      if (current) button.offClick(current);
      current = onClick;
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

function wrapMainButton(button: TgMainButton): SystemButton {
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

    openLink(url) {
      // Выбор метода — дело этого слоя: фичам про Telegram знать нечего, они
      // просто просят «открой ссылку» (CLAUDE.md, изоляция платформы).
      const tgUrl = telegramLinkUrl(url);
      if (tgUrl && tg.openTelegramLink) {
        tg.openTelegramLink(tgUrl);
        return;
      }
      tg.openLink(url);
    },

    openInvoice: (url) =>
      new Promise<InvoiceStatus>((resolve) => {
        tg.openInvoice(url, resolve);
      }),

    setVerticalSwipesEnabled(enabled) {
      if (enabled) tg.enableVerticalSwipes?.();
      else tg.disableVerticalSwipes?.();
    },

    haptic(kind) {
      const h = tg.HapticFeedback;
      if (!h) return;
      if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
      else h.impactOccurred(kind);
    },

    backButton: wrapBackButton(tg.BackButton),
    mainButton: wrapMainButton(tg.MainButton),

    ready() {
      tg.ready();
      tg.expand();
    },
  };
}
