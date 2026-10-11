import { useEffect, useRef, useState } from 'react';
import { motionCurve, motionMs } from './motion';
import { useOverlayOpen } from './overlay';

export type Trend = 'up' | 'down' | null;

export interface Tick {
  /** The number to draw — on its way to the value while it counts. */
  shown: number;
  /** Which way it is counting, null at rest. */
  trend: Trend;
}

/**
 * Money moves like a ticker (motion.css): when a number changes before the
 * viewer's eyes, it counts to the new value over --dur-ticker instead of
 * being swapped. Only then — the first value, and a value that replaced a
 * placeholder, are put down at once; a number counting up as a page opens
 * says nothing changed.
 *
 * `active` — off, the value passes through as is (the mini app; a number not
 * known yet). `series` — what the number measures: a new series is another
 * number, not a change of this one (the top bid of another category), and is
 * put down at once.
 *
 * Under an open dialog it waits: the bid a payment raises is raised under the
 * receipt, and counts when the receipt is closed.
 */
export function useTicker(value: number, active: boolean, series = ''): Tick {
  const [shown, setShown] = useState(value);
  const [trend, setTrend] = useState<Trend>(null);
  const covered = useOverlayOpen();

  // Put down at once: switched on, or another series — by comparison in
  // render, not in an effect (react-hooks/set-state-in-effect).
  const [basis, setBasis] = useState({ active, series });
  if (basis.active !== active || basis.series !== series) {
    setBasis({ active, series });
    setShown(value);
    setTrend(null);
  }

  /** Where a count starts: the number on screen, mid-count included. */
  const onScreen = useRef(value);
  useEffect(() => {
    onScreen.current = shown;
  }, [shown]);

  useEffect(() => {
    if (!active || covered) return;
    const from = onScreen.current;
    if (from === value) return;
    const duration = motionMs('--dur-ticker', 600);
    const curve = motionCurve('--ease-out');
    let start = 0;
    let raf = 0;
    const frame = (now: number) => {
      if (start === 0) {
        start = now;
        setTrend(value > from ? 'up' : 'down');
      }
      const progress = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      setShown(Math.round(from + (value - from) * curve(progress)));
      if (progress < 1) raf = requestAnimationFrame(frame);
      else setTrend(null);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, active, covered]);

  return active ? { shown, trend } : { shown: value, trend: null };
}

export interface Swap {
  /** The place to draw. */
  shown: number | null | undefined;
  /** Which way it last moved — up is a smaller number, a better place. */
  swap: Trend;
}

/**
 * A place (#7 → #3) is not counted through the ones between — #6, #5, #4
 * were never true. It is swapped, and the swap says which way it went; under
 * an open dialog the old place stays until the dialog closes, like the
 * numbers next to it. `active` off — the place passes through as is.
 */
export function useRankSwap(rank: number | null | undefined, active: boolean): Swap {
  const covered = useOverlayOpen();
  const [state, setState] = useState<Swap>({ shown: rank, swap: null });
  if (state.shown !== rank && (!active || !covered)) {
    const was = state.shown;
    const swap: Trend = !active || was == null || rank == null ? null : rank < was ? 'up' : 'down';
    setState({ shown: rank, swap });
  }
  return active ? state : { shown: rank, swap: null };
}
