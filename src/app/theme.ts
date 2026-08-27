import type { Platform } from '@/shared/platform';

/**
 * Тема пользователя проставляется на <html data-theme>, дальше её разбирают
 * токены. В Telegram источник — themeChanged, в вебе — prefers-color-scheme.
 */
export function bindTheme(platform: Platform): () => void {
  const apply = (scheme: string) => {
    document.documentElement.dataset['theme'] = scheme;
  };

  apply(platform.getColorScheme());
  return platform.onColorSchemeChange(apply);
}
