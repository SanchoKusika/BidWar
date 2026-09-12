import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Skeleton.module.css';

/** `inverse` — on the dark panels, where the light sheen would glare. */
export type SkeletonTone = 'surface' | 'inverse';

function size(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Text that is not known yet.
 *
 * It is real text painted over, not a bar of a guessed height: it inherits the
 * font of the slot it stands in, so its line box is exactly the one the value
 * will take. A hardcoded bar drifted from the typography the moment either
 * changed, and the swap moved the page — the jump a placeholder exists to
 * prevent. Pass a sample of the expected value as children to get its width
 * too, or `width` for free-form copy.
 */
export function SkeletonText({
  children,
  width,
  block = false,
  tone = 'surface',
  className,
}: {
  children?: ReactNode;
  width?: number | string;
  block?: boolean;
  tone?: SkeletonTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      data-block={block}
      className={cx(styles.text, className)}
      style={width === undefined ? undefined : ({ '--skeleton-w': size(width) } as CSSProperties)}
    >
      {children ?? ' '}
    </span>
  );
}

/**
 * A shape with its own fixed size: a picture, a badge, a button. Give it the
 * size of the element it replaces — those are fixed in their own CSS, so here
 * they are copied, not guessed.
 */
export function SkeletonBlock({
  width = '100%',
  height,
  radius = 'var(--radius-md)',
  tone = 'surface',
  className,
}: {
  width?: number | string;
  height: number | string;
  radius?: string;
  tone?: SkeletonTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      data-fixed={typeof width === 'number'}
      className={cx(styles.block, className)}
      style={
        {
          '--skeleton-w': size(width),
          '--skeleton-h': size(height),
          '--skeleton-r': radius,
        } as CSSProperties
      }
    />
  );
}
