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
