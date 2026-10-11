import { useEffect, useState } from 'react';
import { motionMs } from './motion';

/**
 * The last value a sheet was drawn with, kept while it is on its way out.
 * The pages clear a sheet's subject in the same click that closes it — the
 * attack target, the payment, the receipt — and a sheet without a subject
 * renders nothing, so it vanished in one frame instead of leaving: the
 * dialog on the site, the bottom sheet's slide down in the mini app.
 */
export function useLingering<T>(value: T | null | undefined, open: boolean): T | null | undefined {
  const [last, setLast] = useState(value);
  if (value != null && value !== last) setLast(value);
  return value ?? (open ? value : last);
}

export interface Presence {
  /** In the DOM. Outlives `open = false` exactly for the way out. */
  mounted: boolean;
  /** The visible state: both transitions start from it. */
  shown: boolean;
  /** What `onShow` answered just before the element was shown. */
  handoff: boolean;
}

/**
 * Keeps a surface in the DOM while it leaves, and gives it one frame in its
 * starting pose before it is shown — without that frame the browser folds
 * both styles into one pass and there is no transition, the surface simply
 * appears. The same mechanics as the mini app's bottom sheet.
 *
 * `exitToken` — the duration token of the way out. The unmount is a timer, not
 * `transitionend`: the event may never come (a background tab, an interrupted
 * transition), and the surface would stay on screen for good.
 *
 * `onShow` — asked at the moment of showing, after the effects of the commit
 * that opened it: by then a surface closed in that same commit has already
 * said it is leaving. Must be stable (a module-level function).
 */
export function usePresence(open: boolean, exitToken: string, onShow?: () => boolean): Presence {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [handoff, setHandoff] = useState(false);

  // The change of `open` by comparison in render, not in an effect
  // (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
    else setShown(false);
  }

  useEffect(() => {
    if (!open || !mounted) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setHandoff(onShow?.() ?? false);
        setShown(true);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open, mounted, onShow]);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), motionMs(exitToken, 120));
    return () => clearTimeout(timer);
  }, [open, mounted, exitToken]);

  return { mounted, shown, handoff };
}
