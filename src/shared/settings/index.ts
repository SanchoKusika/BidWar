/**
 * Настройки отображения, которые человек меняет в профиле.
 *
 * Здесь только то, что применяется прямо в браузере и ничего не спрашивает у
 * сервера: тема, валюта показа и компактные суммы. Хранятся в localStorage —
 * своей строки в БД у них нет, и до появления настоящего профиля на сервере
 * заводить её незачем: настройка на другом устройстве всё равно ничего не
 * ломает.
 *
 * Стор внешний, а не React-контекст: тему применяет `app/theme.ts` напрямую в
 * <html>, вне дерева компонентов, и подписка ему нужна такая же, как экранам.
 */
import { useSyncExternalStore } from 'react';
import type { DisplayCurrency } from '@/shared/lib/format';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface AppSettings {
  /** `auto` — тема оболочки (Telegram или prefers-color-scheme). */
  theme: ThemeChoice;
  /** Валюта показа. Списывается всё равно в валюте провайдера. */
  currency: DisplayCurrency;
  /**
   * «12.5 mln» вместо «12 500 000». Касается только чисел, на которые смотрят:
   * суммы платежа, цена «занять это место» и «сколько нужно, чтобы обойти»
   * остаются точными всегда — по округлённому числу человек действует и
   * недоплатит.
   */
  compactAmounts: boolean;
}

const DEFAULTS: AppSettings = {
  theme: 'auto',
  currency: 'UZS',
  compactAmounts: true,
};

const STORAGE_KEY = 'bidwar.settings.v1';

const THEMES: readonly ThemeChoice[] = ['auto', 'light', 'dark'];
const CURRENCIES: readonly DisplayCurrency[] = ['UZS', 'USD', 'RUB'];

/**
 * Чужая/устаревшая запись в localStorage не должна ронять приложение: каждое
 * поле проверяется по отдельности, непонятное — заменяется значением по
 * умолчанию, а не отбрасывает настройки целиком.
 */
function parse(raw: string | null): AppSettings {
  if (!raw) return DEFAULTS;
  try {
    const stored = JSON.parse(raw) as Partial<Record<keyof AppSettings, unknown>>;
    return {
      theme: THEMES.includes(stored.theme as ThemeChoice)
        ? (stored.theme as ThemeChoice)
        : DEFAULTS.theme,
      currency: CURRENCIES.includes(stored.currency as DisplayCurrency)
        ? (stored.currency as DisplayCurrency)
        : DEFAULTS.currency,
      compactAmounts:
        typeof stored.compactAmounts === 'boolean'
          ? stored.compactAmounts
          : DEFAULTS.compactAmounts,
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Не сохранилось — настройка всё равно применяется до перезагрузки.
  }
  for (const listener of listeners) listener();
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
