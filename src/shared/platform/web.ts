import type { InvoiceStatus, Platform, SystemButton } from './types';

/** Системных кнопок в вебе нет — их роль играет обычная разметка. */
const noopButton: SystemButton = {
  show: () => {},
  hide: () => {},
};

export function createWebPlatform(): Platform {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  return {
    name: 'web',

    getInitData: () => null,

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

    haptic: () => {},

    backButton: noopButton,
    mainButton: noopButton,

    ready: () => {},
  };
}
