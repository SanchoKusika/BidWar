import type { CSSProperties } from 'react';
import { formatCount } from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import styles from './LiveCount.module.css';

export interface LiveCountProps {
  value: number;
  label?: string;
  tone?: string;
  size?: 'sm' | 'md';
  /** Без подложки и рамки — когда счётчик стоит внутри другой карточки. */
  bare?: boolean;
  inverse?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function LiveCount({
  value,
  label = 'online',
  tone,
  size = 'md',
  bare = false,
  inverse = false,
  className,
  style,
}: LiveCountProps) {
  const formatted = formatCount(value);

  return (
    <span
      title={`${formatted} ${label}`}
      data-size={size}
      data-bare={bare}
      data-inverse={inverse}
      className={cx(styles.live, className)}
      style={{ ...(tone ? { '--live-tone': tone } : {}), ...style } as CSSProperties}
    >
      <span className={styles.dot} />
      <span className={styles.value}>{formatted}</span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
