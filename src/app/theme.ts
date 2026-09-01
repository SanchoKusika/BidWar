import type { Platform } from '@/shared/platform';
import { getSettings, subscribeSettings } from '@/shared/settings';

/**
 * Тема пользователя проставляется на <html data-theme>, дальше её разбирают
 * токены. Источников два: выбор в профиле и тема оболочки (в Telegram —
 * themeChanged, в вебе — prefers-color-scheme). Выбор человека сильнее; `auto`
 * означает «отдать решение оболочке» и снова слушать её.
 */
export function bindTheme(platform: Platform): () => void {
  const apply = () => {
    const choice = getSettings().theme;
    document.documentElement.dataset['theme'] =
      choice === 'auto' ? platform.getColorScheme() : choice;
  };

  apply();
  // Подписка на оболочку не снимается при выборе light/dark: переключение
  // обратно на `auto` должно сразу подхватить актуальную тему, а не ждать
  // следующего themeChanged.
  const unbindPlatform = platform.onColorSchemeChange(apply);
  const unbindSettings = subscribeSettings(apply);

  return () => {
    unbindPlatform();
    unbindSettings();
  };
}
