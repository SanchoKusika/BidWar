import { flushSync } from 'react-dom';
import { motionMs } from './motion';

/**
 * What changes: the page (an address) or the theme. The kind is put on
 * <html data-transition> while the transition runs, and `motion.css` times
 * the two differently.
 */
export type TransitionKind = 'page' | 'theme';

let running: ViewTransition | null = null;

/**
 * Applies `update` as a view transition of the whole document: the browser
 * keeps a picture of the old view and fades it into the new one. The update
 * is flushed synchronously inside, so the new view the browser captures is
 * the rendered one — scroll restored and all.
 *
 * Without the API, or with motion reduced (the tokens then zero the
 * durations), the update simply happens, as it did before.
 */
export function withViewTransition(kind: TransitionKind, update: () => void): void {
  if (typeof document.startViewTransition !== 'function' || motionMs('--dur-base', 180) === 0) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset['transition'] = kind;
  const transition = document.startViewTransition(() => flushSync(update));
  running = transition;
  // A transition started over a running one skips it; only the latest may
  // take the attribute away.
  // `finished` rejects only when the update throws, and React has reported
  // that error by then — the catch keeps it from being reported twice.
  transition.finished
    .finally(() => {
      if (running !== transition) return;
      running = null;
      delete root.dataset['transition'];
    })
    .catch(() => {});
}
