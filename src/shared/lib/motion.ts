/**
 * Motion timings for code that animates from script. The numbers live in
 * `shared/ui/tokens/motion.css` and only there: read at the moment of use,
 * they follow the token — including `prefers-reduced-motion`, which zeroes
 * the durations, so a caller that skips a zero-length animation respects it
 * without asking.
 */
export function motionMs(token: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value;
}

/** A distance from the tokens (--shift-*), in pixels. */
export function motionPx(token: string, fallback: number): number {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  );
  return Number.isFinite(value) ? value : fallback;
}

/** A curve from the tokens, in the form the Web Animations API takes. */
export function motionEasing(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'ease-out';
}

/**
 * A curve from the tokens as a function of progress, for motion drawn frame
 * by frame in script (a number counting up). Anything but a cubic-bezier()
 * reads as linear.
 */
export function motionCurve(token: string): (progress: number) => number {
  const match = /cubic-bezier\(([^)]+)\)/.exec(motionEasing(token));
  const points = match?.[1]?.split(',').map(Number) ?? [];
  const [x1, y1, x2, y2] = points;
  if (
    points.length !== 4 ||
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined ||
    points.some((n) => !Number.isFinite(n))
  ) {
    return (progress) => progress;
  }
  return cubicBezier(x1, y1, x2, y2);
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const slope = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (progress: number) => {
    // Newton's method for the t whose x is the progress; the curve is
    // monotonic in x, a few steps are plenty for a counter.
    let t = progress;
    for (let i = 0; i < 8; i++) {
      const error = x(t) - progress;
      const d = slope(t);
      if (Math.abs(error) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    return y(Math.min(1, Math.max(0, t)));
  };
}
