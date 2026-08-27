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
