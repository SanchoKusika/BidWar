import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TabId } from '@/shared/ui/TabBar';
import type { DocId } from '@/shared/content';
import type { ProjectListItem, ShowcaseType } from '@/entities/project';
import type { Platform } from '@/shared/platform';

/** Экран, который ложится поверх вкладки. Сами вкладки в стек не попадают. */
export type Route =
  | { name: 'project'; id: number; segment: ShowcaseType }
  | { name: 'rules'; anchor?: string }
  | { name: 'doc'; id: DocId };

/**
 * Цель атаки, запрошенная со страницы проекта. Attack живёт только на вкладке
 * Paid (там же живёт RaiseSheet), а страница проекта — отдельный экран поверх
 * вкладки: простой переход `setTab('paid')` теряет, кого атаковать. Ссылка на
 * сам объект, а не id — карточка со страницы проекта под рукой, а вкладка
 * Paid не обязана заново искать её в своей (постранично загруженной) выдаче.
 */
export interface AttackRequest {
  target: ProjectListItem;
  rank: number | null;
}

export interface Navigation {
  tab: TabId;
  /** Верхний экран стека или null, когда видна сама вкладка. */
  current: Route | null;
  depth: number;
  /** Незабранный запрос атаки — вкладка Paid читает и отмечает его своим. */
  attackRequest: AttackRequest | null;
  setTab: (tab: TabId) => void;
  push: (route: Route) => void;
  back: () => void;
  /** Переключает на Paid и просит открыть шторку атаки на этой цели. */
  requestAttack: (target: ProjectListItem, rank: number | null) => void;
}

/**
 * Навигация мини-аппа: четыре вкладки и стек экранов поверх текущей.
 *
 * В дизайн-ките это один `view`-стейт без истории — для демо достаточно, для
 * приложения нет: из правил открывается документ, из документа другой, и
 * системная кнопка «назад» в Telegram обязана возвращать на шаг, а не на
 * вкладку. Поэтому здесь стек, а не одно значение.
 *
 * Переключение вкладки стек очищает — так же, как в ките: вкладка это корень,
 * а не ещё один слой.
 */
export function useNavigation(platform: Platform): Navigation {
  const [tab, setTabState] = useState<TabId>('paid');
  const [stack, setStack] = useState<Route[]>([]);
  const [attackRequest, setAttackRequest] = useState<AttackRequest | null>(null);

  const back = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

  const push = useCallback((route: Route) => {
    setStack((s) => [...s, route]);
  }, []);

  const setTab = useCallback((next: TabId) => {
    setStack([]);
    setTabState(next);
  }, []);

  const requestAttack = useCallback((target: ProjectListItem, rank: number | null) => {
    setStack([]);
    setTabState('paid');
    setAttackRequest({ target, rank });
  }, []);

  // Системная кнопка Telegram — единственный способ выйти назад на телефоне,
  // где жеста «свайп от края» у мини-аппа нет.
  useEffect(() => {
    if (stack.length === 0) {
      platform.backButton.hide();
      return;
    }
    platform.backButton.show(back);
    return () => platform.backButton.hide();
  }, [platform, stack.length, back]);

  return useMemo(
    () => ({
      tab,
      current: stack.at(-1) ?? null,
      depth: stack.length,
      attackRequest,
      setTab,
      push,
      back,
      requestAttack,
    }),
    [tab, stack, attackRequest, setTab, push, back, requestAttack],
  );
}
