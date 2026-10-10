import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { TabId } from '@/shared/ui/TabBar';
import type { DocId } from '@/shared/content';
import type { ProjectListItem, ShowcaseType } from '@/entities/project';
import type {
  AttackRequest,
  BoostRequest,
  Navigation,
  ProfileFocusRequest,
  Route,
  VoteRequest,
} from '../navigation';

/**
 * The site's navigation: the same `Navigation` the pages already take, backed
 * by real addresses instead of an in-memory stack. A project page or a rule
 * can be linked, bookmarked and opened in a new tab, and the browser's own
 * back and forward buttons work.
 *
 *   /             Paid Top          /project/42?top=free   a project
 *   /free         Free Top          /rules, /rules/attacks the rules
 *   /tasks        Tasks             /docs/terms            a legal page
 *   /profile      Profile
 */

const DOC_IDS: readonly DocId[] = ['about', 'support', 'terms', 'privacy', 'bot'];

interface Location {
  tab: TabId;
  route: Route | null;
}

const TAB_PATHS: Record<TabId, string> = {
  paid: '/',
  free: '/free',
  tasks: '/tasks',
  profile: '/profile',
};

export function pathOf(tab: TabId, route: Route | null): string {
  if (!route) return TAB_PATHS[tab];
  if (route.name === 'project') {
    return `/project/${route.id}${route.segment === 'free' ? '?top=free' : ''}`;
  }
  if (route.name === 'rules') return route.anchor ? `/rules/${route.anchor}` : '/rules';
  return `/docs/${route.id}`;
}

function parse(pathname: string, search: string, fallbackTab: TabId): Location {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const [head, arg] = parts;

  if (head === 'free') return { tab: 'free', route: null };
  if (head === 'tasks') return { tab: 'tasks', route: null };
  if (head === 'profile') return { tab: 'profile', route: null };

  if (head === 'project' && arg && /^\d+$/.test(arg)) {
    const segment: ShowcaseType =
      new URLSearchParams(search).get('top') === 'free' ? 'free' : 'paid';
    return { tab: segment, route: { name: 'project', id: Number(arg), segment } };
  }
  if (head === 'rules') {
    return { tab: fallbackTab, route: { name: 'rules', ...(arg ? { anchor: arg } : {}) } };
  }
  if (head === 'docs' && DOC_IDS.includes(arg as DocId)) {
    return { tab: fallbackTab, route: { name: 'doc', id: arg as DocId } };
  }
  return { tab: 'paid', route: null };
}

const current = (fallbackTab: TabId): Location =>
  parse(window.location.pathname, window.location.search, fallbackTab);

/** Scroll position kept on the history entry, so back lands where it left. */
interface EntryState {
  scroll?: number;
  /** Set on entries the site pushed itself — «back» from them stays on the site. */
  inApp?: boolean;
}

/** How far the pages are scrolled: in their own element, or in the window. */
function scrollOf(el: HTMLElement | null | undefined): number {
  return el ? el.scrollTop : window.scrollY;
}

function setScroll(el: HTMLElement | null | undefined, top: number): void {
  if (el) el.scrollTop = top;
  else window.scrollTo(0, top);
}

/**
 * `scrollerRef` — the element the pages scroll in, when it is not the window:
 * on a phone the site keeps the mini app's frame, where the tab bar stays put
 * and the content scrolls under it.
 */
export function useWebNavigation(scrollerRef?: RefObject<HTMLElement | null>): Navigation {
  const [location, setLocation] = useState<Location>(() => current('paid'));
  const [attackRequest, setAttackRequest] = useState<AttackRequest | null>(null);
  const [boostRequest, setBoostRequest] = useState<BoostRequest | null>(null);
  const [profileFocus, setProfileFocus] = useState<ProfileFocusRequest | null>(null);
  const [voteRequest, setVoteRequest] = useState<VoteRequest | null>(null);
  /** Scroll to restore after the next render; null — start at the top. */
  const pendingScroll = useRef<number | null>(null);
  const tabRef = useRef(location.tab);

  useEffect(() => {
    tabRef.current = location.tab;
  }, [location.tab]);

  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    const onPop = (event: PopStateEvent) => {
      pendingScroll.current = (event.state as EntryState | null)?.scroll ?? 0;
      setLocation(current(tabRef.current));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A new address starts at the top; back and forward return to the scroll
  // the entry was left at. Retried for a few frames: the page underneath is
  // remounted and may still be filling in from the cache.
  useLayoutEffect(() => {
    const el = scrollerRef?.current;
    const target = pendingScroll.current ?? 0;
    pendingScroll.current = null;
    let frames = 0;
    let raf = 0;
    const restore = () => {
      setScroll(el, target);
      if (scrollOf(el) < target - 1 && frames++ < 30) raf = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(raf);
  }, [location, scrollerRef]);

  const go = useCallback(
    (tab: TabId, route: Route | null) => {
      const here = (window.history.state ?? {}) as EntryState;
      const scroll = scrollOf(scrollerRef?.current);
      window.history.replaceState({ ...here, scroll } satisfies EntryState, '');
      window.history.pushState({ inApp: true } satisfies EntryState, '', pathOf(tab, route));
      setLocation({ tab, route });
    },
    [scrollerRef],
  );

  const setTab = useCallback((tab: TabId) => go(tab, null), [go]);
  const push = useCallback((route: Route) => go(tabRef.current, route), [go]);

  /** Back within the site; a page opened straight from a link goes to its top. */
  const back = useCallback(() => {
    if ((window.history.state as EntryState | null)?.inApp) {
      window.history.back();
      return;
    }
    go(tabRef.current, null);
  }, [go]);

  const requestAttack = useCallback(
    (target: ProjectListItem, rank: number | null) => {
      go('paid', null);
      setAttackRequest({ target, rank });
    },
    [go],
  );

  const requestBoost = useCallback(
    (target: ProjectListItem, rank: number | null) => {
      go('paid', null);
      setBoostRequest({ target, rank });
    },
    [go],
  );

  const requestVote = useCallback(
    (target: ProjectListItem, rank: number | null) => {
      go('free', null);
      setVoteRequest({ target, rank });
    },
    [go],
  );

  const requestProfileFocus = useCallback(
    (section: ProfileFocusRequest['section']) => {
      go('profile', null);
      setProfileFocus({ section });
    },
    [go],
  );

  return useMemo(
    () => ({
      tab: location.tab,
      current: location.route,
      depth: location.route ? 1 : 0,
      attackRequest,
      boostRequest,
      profileFocus,
      voteRequest,
      setTab,
      push,
      back,
      requestAttack,
      requestBoost,
      requestProfileFocus,
      requestVote,
    }),
    [
      location,
      attackRequest,
      boostRequest,
      profileFocus,
      voteRequest,
      setTab,
      push,
      back,
      requestAttack,
      requestBoost,
      requestProfileFocus,
      requestVote,
    ],
  );
}
