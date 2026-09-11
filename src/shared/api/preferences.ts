import { getSupabase } from './client';
import { functionErrorMessage } from './errors';
import type { Locale } from '@/shared/i18n/locale';

/**
 * Настройки, по которым решает сервер, а не экран: три вида уведомлений и язык,
 * на котором пишет бот.
 *
 * Всё остальное из настроек (тема, валюта показа, компактные суммы, вибрация)
 * сюда не ходит: это свойства устройства, и серверу о них знать нечего.
 * Граница проходит по вопросу «кто этим пользуется»: боту `localStorage` не
 * виден, поэтому его настройки живут в базе.
 */
export interface Preferences {
  notifyAttacked: boolean;
  notifyRankLost: boolean;
  notifyVotes: boolean;
  notifyReferral: boolean;
  /** null — язык руками не выбирали, бот возьмёт язык оболочки Telegram. */
  language: Locale | null;
}

export type PreferencesPatch = Partial<Preferences>;

async function call(initData: string, patch?: PreferencesPatch): Promise<Preferences> {
  const { data, error } = await getSupabase().functions.invoke<Preferences>('preferences', {
    method: 'POST',
    body: patch ? { initData, patch } : { initData },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось сохранить настройки'));
  if (!data) throw new Error('preferences ответил пусто');
  return data;
}

export const fetchPreferences = (initData: string): Promise<Preferences> => call(initData);

/**
 * Ответ — то, что легло в базу, а не то, что отправили: значение, которое
 * сервер не принял, не должно остаться на экране включённым.
 */
export const savePreferences = (initData: string, patch: PreferencesPatch): Promise<Preferences> =>
  call(initData, patch);
