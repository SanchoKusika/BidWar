import { useSyncExternalStore } from 'react';

/**
 * Which dialogs the site has on screen, kept outside React because three
 * kinds of readers need it: the one scrim under all dialogs, a dialog that
 * opens while another is still leaving, and motion on the page that waits
 * until the page can be seen again.
 *
 * The scrim is one for all of them because a payment is a chain of dialogs —
 * raise, then pay, then the receipt — each its own component. With a scrim
 * per dialog the dimming dropped and came back at every step.
 */
let open = 0;
let leaving = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

/** Counted as open until the returned release. */
export function holdOverlay(): () => void {
  open += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    open -= 1;
    emit();
  };
}

/** Counted as on its way out until the returned release. */
export function markOverlayLeaving(): () => void {
  leaving += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    leaving -= 1;
  };
}

/** Another dialog is leaving right now — the one opening takes over from it. */
export function isOverlayLeaving(): boolean {
  return leaving > 0;
}

export function isOverlayOpen(): boolean {
  return open > 0;
}

export function subscribeOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Some dialog is open: the page under it is dimmed. */
export function useOverlayOpen(): boolean {
  return useSyncExternalStore(subscribeOverlay, isOverlayOpen);
}
