import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Skeleton.module.css';

function Bar({ w, h = 10, r }: { w: number | string; h?: number; r?: string }) {
  return (
    <span
      className={styles.bar}
      style={
        {
          '--bar-w': typeof w === 'number' ? `${w}px` : w,
          '--bar-h': `${h}px`,
          ...(r ? { '--bar-r': r } : {}),
        } as CSSProperties
      }
    />
  );
}

/**
 * A reserved rectangle. The point is the reservation: a block that appears when
 * its answer lands pushes everything under it, and that jump is what reads as
 * "the page is assembling itself". Give the space first, fill it later.
 */
export function SkeletonBox({
  width = '100%',
  height,
  radius = 'var(--radius-md)',
  className,
  style,
}: {
  width?: number | string;
  height: number;
  radius?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div aria-busy="true" className={className} style={style}>
      <Bar w={width} h={height} r={radius} />
    </div>
  );
}

/**
 * The number in a page header, while it is still unknown. Same footprint as
 * `StatBlock` at size md: caption over value, right-aligned.
 */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div aria-busy="true" className={cx(styles.stat, className)}>
      <Bar w={64} h={8} />
      <Bar w={48} h={18} r="var(--radius-sm)" />
    </div>
  );
}

export function SkeletonCard({
  showActions = false,
  className,
  style,
}: {
  showActions?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx(styles.card, className)} style={style}>
      <div className={styles.identity}>
        <Bar w={32} h={32} r="var(--radius-md)" />
        <Bar w={52} h={52} r="var(--radius-thumb)" />
        <div className={styles.lines}>
          <Bar w="58%" h={12} />
          <Bar w="88%" h={9} />
          <Bar w="40%" h={9} />
        </div>
        <div className={styles.numbers}>
          <Bar w={28} h={8} />
          <Bar w={72} h={16} r="var(--radius-sm)" />
        </div>
      </div>

      {showActions && (
        <div className={styles.actions}>
          <Bar w="50%" h={36} r="var(--radius-control)" />
          <Bar w="50%" h={36} r="var(--radius-control)" />
        </div>
      )}
    </div>
  );
}

export function SkeletonFeed({
  rows = 4,
  showActions = false,
  className,
  style,
}: {
  rows?: number;
  showActions?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div aria-busy="true" className={cx(styles.feed, className)} style={style}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} showActions={showActions} style={{ opacity: 1 - i * 0.14 }} />
      ))}
    </div>
  );
}

/**
 * The project page while it loads. Shaped like the page rather than like a
 * feed: the old placeholder was three card rows, so the swap to a header plus
 * numbers plus activity moved everything on screen — the jump this is meant to
 * prevent.
 */
export function SkeletonProjectPage({ className }: { className?: string }) {
  return (
    <div aria-busy="true" className={cx(styles.page, className)}>
      <div className={styles.pageHead}>
        <Bar w={52} h={52} r="var(--radius-thumb)" />
        <div className={styles.lines}>
          <Bar w="62%" h={16} />
          <Bar w="84%" h={10} />
        </div>
      </div>

      <div className={styles.pageRow}>
        <Bar w="48%" h={64} r="var(--radius-card)" />
        <Bar w="48%" h={64} r="var(--radius-card)" />
      </div>

      <Bar w="100%" h={44} r="var(--radius-control)" />
      <SkeletonFeed rows={2} />
    </div>
  );
}

/**
 * The profile while its three answers are in flight — session, own projects and
 * spending. They land at different moments, and without reserved space each
 * arrival shoved the blocks below it.
 */
export function SkeletonProfile({ className }: { className?: string }) {
  return (
    <div aria-busy="true" className={cx(styles.page, className)}>
      <div className={styles.pageRow}>
        <Bar w="48%" h={96} r="var(--radius-card)" />
        <Bar w="48%" h={96} r="var(--radius-card)" />
      </div>
      <SkeletonCard />
      <Bar w="100%" h={84} r="var(--radius-card)" />
    </div>
  );
}
