/**
 * Настройки отображения, которые человек меняет в профиле.
 *
 * Здесь только то, что применяется прямо в браузере и ничего не спрашивает у
 * сервера. Перечислять поля тут больше нечего — они ниже, в `AppSettings`, и
 * список в комментарии всё равно отстанет от кода. Хранятся в localStorage —
 * своей строки в БД у них нет, и до появления настоящего профиля на сервере
 * заводить её незачем: настройка на другом устройстве всё равно ничего не
 * ломает.
 *
 * Стор внешний, а не React-контекст: тему применяет `app/theme.ts` напрямую в
 * <html>, вне дерева компонентов, и подписка ему нужна такая же, как экранам.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locale';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface AppSettings {
  /** `auto` — тема оболочки (Telegram или prefers-color-scheme). */
  theme: ThemeChoice;
  /**
   * «12.5 mln» вместо «12 500 000». Касается только чисел, на которые смотрят:
   * суммы платежа, цена «занять это место» и «сколько нужно, чтобы обойти»
   * остаются точными всегда — по округлённому числу человек действует и
   * недоплатит.
   */
  compactAmounts: boolean;
  /**
   * Отклик на действия, которые двигают деньги и очки: ставка, атака, голос.
   * Живёт здесь, а не среди заглушек: `platform.haptic()` в слое платформы был
   * всё это время, не хватало только настройки и вызовов.
   */
  haptics: boolean;
  /**
   * Interface language. Russian by default — the product's market — whatever
   * the Telegram shell or the browser speaks; English only once picked in
   * settings, and that choice survives a restart.
   */
  language: Locale;
}

/** What a first launch starts with; nothing here is guessed from the shell. */
const DEFAULTS: AppSettings = {
  theme: 'auto',
  compactAmounts: true,
  haptics: true,
  language: DEFAULT_LOCALE,
};

const STORAGE_KEY = 'bidwar.settings.v1';

const THEMES: readonly ThemeChoice[] = ['auto', 'light', 'dark'];

/**
 * Чужая/устаревшая запись в localStorage не должна ронять приложение: каждое
 * поле проверяется по отдельности, непонятное — заменяется значением по
 * умолчанию, а не отбрасывает настройки целиком.
 */
function parse(raw: string | null): AppSettings {
  if (!raw) return DEFAULTS;
  try {
    const stored = JSON.parse(raw) as Partial<Record<keyof AppSettings | 'languageChosen', unknown>>;
    return {
      theme: THEMES.includes(stored.theme as ThemeChoice)
        ? (stored.theme as ThemeChoice)
        : DEFAULTS.theme,
      compactAmounts:
        typeof stored.compactAmounts === 'boolean'
          ? stored.compactAmounts
          : DEFAULTS.compactAmounts,
      haptics: typeof stored.haptics === 'boolean' ? stored.haptics : DEFAULTS.haptics,
      // Only a language picked by hand survives. Before 09.10.2026 the start
      // language came from the Telegram shell and was stored as if chosen —
      // an English Telegram left the app in English; those guesses reset to
      // Russian, the product's default.
      language:
        stored.languageChosen === true && LOCALES.includes(stored.language as Locale)
          ? (stored.language as Locale)
          : DEFAULTS.language,
    };
  } catch {
    return DEFAULTS;
  }
}

function read(): AppSettings {
  try {
    return parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Приватный режим / выключенное хранилище: настройки живут одну сессию.
    return DEFAULTS;
  }
}

let current: AppSettings = read();
/** Whether the language was picked in settings — kept beside the settings. */
let languageChosen = readLanguageChosen();

function readLanguageChosen(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { languageChosen?: unknown }).languageChosen === true : false;
  } catch {
    return false;
  }
}
const listeners = new Set<() => void>();

export function getSettings(): AppSettings {
  return current;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  if (key === 'language') languageChosen = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, languageChosen }));
  } catch {
    // Не сохранилось — настройка всё равно применяется до перезагрузки.
  }
  for (const listener of listeners) listener();
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
