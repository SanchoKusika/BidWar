import { Component, createRef, type ReactNode } from 'react';
import { motionEasing, motionMs, motionPx } from '@/shared/lib/motion';
import { isOverlayOpen, subscribeOverlay } from '@/shared/lib/overlay';

export interface FlipGroupProps {
  /**
   * Which list is shown — a filter, a scope. A new list is not a
   * rearrangement of the old one: it fades in whole, nothing travels.
   */
  list: string;
  /** The arrangement: ids in order, '' while there is nothing to show. */
  order: string;
  className?: string;
  children: ReactNode;
}

interface Snapshot {
  /** Where each `[data-flip-id]` stood on screen just before the change. */
  rects: Map<string, DOMRect>;
  /** A new list, or the first rows after a placeholder: fade in, no moves. */
  reveal: boolean;
}

/**
 * Lets a list show how it changed: rows that changed places travel from the
 * old place to the new one (FLIP), rows that are new rise into theirs, the
 * own row that moved up is marked once, and a list that came in place of a
 * placeholder or of another list fades in. Elements opt in with
 * `data-flip-id`; `data-flip-own` marks the viewer's own row, whose first
 * child is the card that gets the mark.
 *
 * A class because only `getSnapshotBeforeUpdate` reads the DOM in the one
 * moment that matters — after React has the new list and before it touches
 * the page. Measured anywhere else, the old positions are either gone or
 * stale. Only when `order` changes: the rest of the renders cost nothing.
 *
 * While a dialog is open the motion waits, paused at its first frame: the
 * board a payment rearranges is rearranged under the receipt, and plays
 * when the receipt is closed — where it can be seen.
 */
export class FlipGroup extends Component<FlipGroupProps> {
  private root = createRef<HTMLDivElement>();
  private running: Animation[] = [];
  private unsubscribe: (() => void) | null = null;

  override getSnapshotBeforeUpdate(prev: FlipGroupProps): Snapshot | null {
    const { list, order } = this.props;
    const root = this.root.current;
    if (!root || order === '' || (prev.order === order && prev.list === list)) return null;
    const reveal = prev.list !== list || prev.order === '';
    const rects = new Map<string, DOMRect>();
    if (!reveal) {
      for (const el of root.querySelectorAll<HTMLElement>('[data-flip-id]')) {
        const id = el.dataset['flipId'];
        if (id) rects.set(id, el.getBoundingClientRect());
      }
    }
    return { rects, reveal };
  }

  override componentDidUpdate(_prev: FlipGroupProps, _state: unknown, snapshot: Snapshot | null) {
    const root = this.root.current;
    if (!snapshot || !root) return;
    // Whatever still runs is cancelled first: the new places are measured
    // without its transforms, while the old ones were measured with them —
    // so an interrupted move continues from where it was on screen.
    this.stop();

    const enter = motionMs('--dur-base', 180);
    if (enter === 0) return;
    const easeOut = motionEasing('--ease-out');

    if (snapshot.reveal) {
      this.start([
        root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: enter, easing: easeOut }),
      ]);
      return;
    }

    const move = motionMs('--dur-slow', 260);
    const inOut = motionEasing('--ease-in-out');
    const shift = motionPx('--shift-sm', 4);
    const view = window.innerHeight;
    // Off screen nothing is seen moving; a quarter of a screen around it
    // still is, as it comes into view.
    const near = (r: DOMRect) => r.bottom > -view / 4 && r.top < view * 1.25;
    const fadeIn = (el: HTMLElement) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: enter, easing: easeOut });

    const animations: Animation[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('[data-flip-id]')) {
      const first = snapshot.rects.get(el.dataset['flipId'] ?? '');
      const last = el.getBoundingClientRect();
      let rose = false;

      if (!first) {
        if (!near(last)) continue;
        animations.push(
          el.animate(
            [
              { opacity: 0, transform: `translateY(${shift}px)` },
              { opacity: 1, transform: 'none' },
            ],
            { duration: enter, easing: easeOut },
          ),
        );
        rose = true;
      } else {
        const dy = first.top - last.top;
        if (Math.abs(dy) < 1 || (!near(first) && !near(last))) continue;
        if (Math.abs(dy) > view) {
          // Too far to follow: the row just appears in its new place.
          if (near(last)) animations.push(fadeIn(el));
        } else {
          // A row that climbs overtakes the ones it passes: it travels above
          // them. In DOM order it would slide under the very rows it beat.
          // The rows are flex items, so z-index applies without positioning.
          const layer = dy > 0 ? 1 : 0;
          animations.push(
            el.animate(
              [
                { transform: `translateY(${dy}px)`, zIndex: layer },
                { transform: 'none', zIndex: layer },
              ],
              { duration: move, easing: inOut },
            ),
          );
        }
        rose = dy > 0;
      }

      const card = el.firstElementChild;
      if (rose && el.dataset['flipOwn'] !== undefined && card instanceof HTMLElement) {
        animations.push(mark(card, first ? move : enter, easeOut));
      }
    }
    this.start(animations);
  }

  override componentWillUnmount() {
    this.stop();
  }

  private start(animations: Animation[]) {
    this.running = animations;
    if (!isOverlayOpen()) return;
    for (const animation of animations) animation.pause();
    this.unsubscribe = subscribeOverlay(() => {
      if (isOverlayOpen()) return;
      this.unsubscribe?.();
      this.unsubscribe = null;
      for (const animation of this.running) animation.play();
    });
  }

  private stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const animation of this.running) animation.cancel();
    this.running = [];
  }

  override render() {
    return (
      <div ref={this.root} className={this.props.className}>
        {this.props.children}
      </div>
    );
  }
}

/**
 * «You are here now»: a ring in the card's own accent that widens and fades
 * once, after the card has arrived. An outline, so the card's own shadow and
 * border stay as they are.
 */
function mark(card: HTMLElement, delay: number, easing: string): Animation {
  const accent = getComputedStyle(card).getPropertyValue('--card-accent').trim() || 'currentColor';
  return card.animate(
    [
      { outline: `2px solid ${accent}`, outlineOffset: '0px' },
      { outline: '2px solid transparent', outlineOffset: '6px' },
    ],
    { duration: motionMs('--dur-highlight', 1200), delay, easing },
  );
}
