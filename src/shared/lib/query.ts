import { useCallback, useEffect, useState } from 'react';

/**
 * Кэш ответов на время жизни вкладки и хук поверх него.
 *
 * Зачем: `Shell` рисует ровно одну вкладку и размонтирует остальные, поэтому
 * каждый возврат на Paid начинал загрузку с нуля и показывал скелетон — при
 * том, что данные не менялись. То же со сменой категории: список обнулялся, и
 * страница прыгала. Кэш это чинит один раз для всех витрин, а не по месту.
 *
 * Схема stale-while-revalidate: сохранённый ответ отдаётся сразу же, свежий
 * запрос уходит в фоне и подменяет его молча. Отсюда два разных флага вместо
 * одного `loading`:
 *
 * - `loading` — показывать нечего, скелетон уместен;
 * - `refreshing` — на экране прошлый ответ, а свежий ещё в пути.
 *
 * Различать их обязательно: после оплаты страница Paid ждёт ИМЕННО свежий
 * ранг, и `loading === false` над устаревшими данными подставил бы в квитанцию
 * позицию до платежа.
 *
 * Кэш живёт в модуле, а не в состоянии React, потому что переживает
 * размонтирование страницы — в этом весь смысл. Данных пользователя он не
 * хранит дольше сессии: перезагрузка мини-аппа его очищает.
 */
const store = new Map<string, unknown>();

/** Сбросить сохранённое — целиком или по префиксу ключа. */
export function dropQueryCache(prefix?: string): void {
  if (prefix === undefined) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export interface QueryState<T> {
  /** Ответ для текущего ключа — сохранённый или свежий. null, пока его нет. */
  data: T | null;
  /** Нечего показать и запрос в пути. */
  loading: boolean;
  /** Данные на экране есть, но в пути свежие. */
  refreshing: boolean;
  /** Запрос не удался и показать при этом нечего. */
  error: boolean;
  /** Перезапросить тот же ключ, не убирая с экрана уже показанное. */
  refresh: () => void;
  /** Записать данные под текущий ключ — для дозагрузки страниц. */
  mutate: (next: T) => void;
}

interface Entry<T> {
  key: string;
  data: T | null;
  error: boolean;
  /**
   * Значение `token` на момент запроса, чей ответ здесь лежит. Так виден
   * незакрытый `refresh()`: ответа для текущей пары «ключ + токен» ещё нет.
   * -1 — данные подставлены из кэша, своего запроса под них не было.
   */
  stamp: number;
}

const MISSING = -1;

function fromCache<T>(key: string | null): Entry<T> {
  if (key === null) return { key: '', data: null, error: false, stamp: MISSING };
  const cached = store.get(key) as T | undefined;
  return { key, data: cached ?? null, error: false, stamp: MISSING };
}

/**
 * `fetcher` обязан быть стабильным (useCallback с примитивными зависимостями):
 * он входит в зависимости эффекта, и новая ссылка на каждый рендер вызвала бы
 * бесконечный перезапрос. `key === null` — данных ещё не за что просить
 * (например, нет userId): запрос не уходит, состояние остаётся пустым.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  const [entry, setEntry] = useState<Entry<T>>(() => fromCache<T>(key));
  const [token, setToken] = useState(0);

  // Смена ключа: сравнение в рендере, а не эффект — setState синхронно в теле
  // эффекта запрещён (react-hooks/set-state-in-effect, CLAUDE.md), а ждать
  // эффекта нельзя: между ним и рендером страница успела бы моргнуть
  // скелетоном поверх уже сохранённого ответа. Повторно не сработает —
  // после setEntry ключи совпадают.
  if (key !== null && entry.key !== key) {
    const cached = store.get(key) as T | undefined;
    if (cached !== undefined) setEntry({ key, data: cached, error: false, stamp: MISSING });
  }

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    const stamp = token;

    fetcher()
      .then((data) => {
        if (cancelled) return;
        store.set(key, data);
        setEntry({ key, data, error: false, stamp });
      })
      .catch(() => {
        if (cancelled) return;
        setEntry((prev) =>
          // Ревалидация поверх показанного не должна стирать экран: данные на
          // нём настоящие, просто не обновились. Отказ виден как ошибка только
          // тогда, когда показывать всё равно нечего.
          prev.key === key && prev.data !== null
            ? { ...prev, stamp }
            : { key, data: null, error: true, stamp },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [key, fetcher, token]);

  const mutate = useCallback(
    (next: T) => {
      if (key === null) return;
      store.set(key, next);
      setEntry((prev) => (prev.key === key ? { ...prev, data: next } : prev));
    },
    [key],
  );

  const fresh = entry.key === key;
  const data = fresh ? entry.data : null;
  const pending = key !== null && (!fresh || entry.stamp !== token);

  return {
    data,
    loading: pending && data === null,
    refreshing: pending && data !== null,
    error: fresh && entry.error && data === null,
    refresh: useCallback(() => setToken((n) => n + 1), []),
    mutate,
  };
}
