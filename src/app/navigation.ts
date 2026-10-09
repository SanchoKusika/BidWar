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

/**
 * Проект, чью ставку просят поднять донатом со страницы проекта. Отдельно от
 * `AttackRequest` по той же причине, по какой они разные кнопки: путь один
 * (вкладка Paid), а действие и деньги — разные.
 */
export interface BoostRequest {
  target: ProjectListItem;
  rank: number | null;
}

/**
 * A section of the profile to bring into view on arrival. The tasks tab sends
 * «invite a friend» here: landing at the top of the profile left the person
 * to hunt for the referral link themselves. An object, not a string, so the
 * same request is handled once and a new tap is a new request.
 */
export interface ProfileFocusRequest {
  section: 'referral';
}

export interface Navigation {
  tab: TabId;
  /** Верхний экран стека или null, когда видна сама вкладка. */
  current: Route | null;
  depth: number;
  /** Незабранный запрос атаки — вкладка Paid читает и отмечает его своим. */
  attackRequest: AttackRequest | null;
  /** Незабранный запрос доната — читается там же и так же. */
  boostRequest: BoostRequest | null;
  /** Section the profile should scroll to when it opens. */
  profileFocus: ProfileFocusRequest | null;
  setTab: (tab: TabId) => void;
  push: (route: Route) => void;
  back: () => void;
  /** Переключает на Paid и просит открыть шторку атаки на этой цели. */
  requestAttack: (target: ProjectListItem, rank: number | null) => void;
  /** Переключает на Paid и просит открыть шторку Raise для чужого проекта. */
  requestBoost: (target: ProjectListItem, rank: number | null) => void;
  /** Switches to the profile and asks it to scroll to a section. */
  requestProfileFocus: (section: ProfileFocusRequest['section']) => void;
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
  const [boostRequest, setBoostRequest] = useState<BoostRequest | null>(null);
  const [profileFocus, setProfileFocus] = useState<ProfileFocusRequest | null>(null);

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

  const requestBoost = useCallback((target: ProjectListItem, rank: number | null) => {
    setStack([]);
    setTabState('paid');
    setBoostRequest({ target, rank });
  }, []);

  const requestProfileFocus = useCallback((section: ProfileFocusRequest['section']) => {
    setStack([]);
    setTabState('profile');
    setProfileFocus({ section });
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
      boostRequest,
      profileFocus,
      setTab,
      push,
      back,
      requestAttack,
      requestBoost,
      requestProfileFocus,
    }),
    [
      tab,
      stack,
      attackRequest,
      boostRequest,
      profileFocus,
      setTab,
      push,
      back,
      requestAttack,
      requestBoost,
      requestProfileFocus,
    ],
  );
}
