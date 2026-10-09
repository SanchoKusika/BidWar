import type { BackButton, InvoiceStatus, Platform, SystemButton } from './types';
import { storedLogin } from './webLogin';

/** Системных кнопок в вебе нет — их роль играет обычная разметка. */
const noopBackButton: BackButton = {
  show: () => {},
  hide: () => {},
};

const noopButton: SystemButton = {
  show: () => {},
  hide: () => {},
};

export function createWebPlatform(): Platform {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  return {
    name: 'web',

    // The site's sign-in (Telegram Login Widget), checked by the server the
    // same way as the mini app's launch data. Null for a guest.
    getInitData: storedLogin,

    getColorScheme: () => (media.matches ? 'dark' : 'light'),

    onColorSchemeChange(handler) {
      const listener = (e: MediaQueryListEvent) => handler(e.matches ? 'dark' : 'light');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },

    openLink(url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    /**
     * Hosted-оплата уводит на страницу провайдера, поэтому вернуться с
     * результатом в текущую сессию нельзя — статус придёт вебхуком.
     */
    openInvoice(url) {
      window.location.assign(url);
      return Promise.resolve<InvoiceStatus>('pending');
    },

    setVerticalSwipesEnabled: () => {},

    haptic: () => {},

    // The browser's language is a guess about the person, not a fact — but
    // with nothing at all a Russian site greeted everyone in English. It is
    // only the starting point: a choice made in settings wins and is kept.
    getLanguageCode: () => navigator.language || null,

    backButton: noopBackButton,
    mainButton: noopButton,

    ready: () => {},
  };
}
