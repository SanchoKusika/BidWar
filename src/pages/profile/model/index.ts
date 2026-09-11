import { useCallback, useState } from 'react';
import { useOwnPosition, type ProjectListItem } from '@/entities/project';
import {
  fetchMySpending,
  fetchPreferences,
  savePreferences,
  type Preferences,
  type PreferencesPatch,
  type Spending,
} from '@/shared/api';
import { getPlatform } from '@/shared/platform';
import { strings } from '@/shared/i18n/strings';
import { useSettings } from '@/shared/settings';
import { useQuery } from '@/shared/lib/query';

export interface MyProject {
  project: ProjectListItem;
  /** Позиция в общем топе своей витрины, null — если посчитать не удалось. */
  rank: number | null;
}

export interface MyProjectsState {
  projects: MyProject[];
  loading: boolean;
  /** Свежие данные ещё в пути, но показывать уже есть что (см. shared/lib/query). */
  refreshing: boolean;
  retry: () => void;
}

/**
 * Свои записи в обоих топах — по одной на топ, больше быть не может (уникальные
 * индексы projects_one_active_per_user_and_type_idx). Переиспользуем ту же
 * модель, что и панель «твоя позиция» на витринах: ранг считается на лету, а
 * не хранится, и разрез здесь всегда общий — в профиле нет фильтра по
 * категории, относительно которого его можно было бы сузить.
 *
 * Платная запись идёт первой: она стоит денег, и смотрят на неё чаще.
 */
export function useMyProjects(userId: string | null): MyProjectsState {
  const paid = useOwnPosition('paid', null, userId);
  const free = useOwnPosition('free', null, userId);

  const projects: MyProject[] = [];
  if (paid.project) projects.push({ project: paid.project, rank: paid.rank });
  if (free.project) projects.push({ project: free.project, rank: free.rank });

  return {
    projects,
    loading: paid.loading || free.loading,
    refreshing: paid.refreshing || free.refreshing,
    retry: () => {
      paid.retry();
      free.retry();
    },
  };
}

export interface SpendingState {
  spending: Spending | null;
  retry: () => void;
}

/**
 * Свои траты для карточки «PAID» и списка чеков.
 *
 * Ключ кэша — userId, а не initData: initData обновляется Telegram'ом на
 * каждый запуск, и ключ по нему промахивался бы мимо сохранённого ответа при
 * каждом открытии мини-аппа.
 *
 * Отказ (нет initData в вебе, сеть, функция) оставляет `spending` пустым, и
 * блок трат не рисуется вовсе — ноль поверх настоящих платежей был бы
 * неправдой (паспорт пропа в ProfileScreen).
 */
export function useMySpending(userId: string | null): SpendingState {
  const fetcher = useCallback(() => {
    const initData = getPlatform().getInitData();
    if (!initData) return Promise.reject(new Error('initData недоступен'));
    return fetchMySpending(initData);
  }, []);

  const query = useQuery<Spending>(userId ? `spending:${userId}` : null, fetcher);
  return { spending: query.data, retry: query.refresh };
}

export interface NotificationPrefsState {
  /** null — настройки ещё не получены: группу тумблеров рисовать не на чем. */
  value: Preferences | null;
  /** Последнее сохранение не доехало; тумблеры при этом показывают серверное. */
  error: string | null;
  set: (patch: PreferencesPatch) => void;
}

/**
 * Настройки уведомлений. Живут на сервере, а не в `shared/settings`: по ним
 * решает бот, которому `localStorage` не виден.
 *
 * Пока ответа нет, группа тумблеров не рисуется вовсе — тот же принцип, что у
 * трат и у ленты событий: выключатель, показывающий выдуманное состояние, врёт
 * сильнее отсутствующего.
 *
 * Сохранение оптимистичное только на вид: на экран кладётся ответ сервера, а не
 * отправленное значение. Не доехало — состояние остаётся прежним, и рядом
 * появляется строка об этом.
 */
export function useNotificationPrefs(userId: string | null): NotificationPrefsState {
  const language = useSettings().language;

  const fetcher = useCallback(async () => {
    const initData = getPlatform().getInitData();
    if (!initData) throw new Error('initData недоступен');

    const prefs = await fetchPreferences(initData);
    if (prefs.language !== null) return prefs;

    // Язык, выбранный до среза 1.9, лежит только на устройстве: колонка
    // `users.language` появилась позже и пишется лишь при следующем выборе
    // руками. Значит, бот всем прежним читателям писал бы на языке оболочки —
    // ровно то враньё, ради которого колонку и заводили. Досылаем сохранённый
    // выбор один раз: после записи он уже не null, и ветка больше не сработает.
    return savePreferences(initData, { language });
  }, [language]);

  const query = useQuery<Preferences>(userId ? `preferences:${userId}` : null, fetcher);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    (patch: PreferencesPatch) => {
      const initData = getPlatform().getInitData();
      if (!initData) return;
      setError(null);
      void savePreferences(initData, patch)
        .then((next) => {
          query.mutate(next);
        })
        .catch((failure: unknown) => {
          setError(failure instanceof Error ? failure.message : strings.settings.saveFailed);
        });
    },
    [query],
  );

  return { value: query.data, error, set };
}
