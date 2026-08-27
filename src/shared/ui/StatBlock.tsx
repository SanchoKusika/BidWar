import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import {
  CURRENCY_SUFFIX,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import type { Segment } from './OgPreview';
import styles from './StatBlock.module.css';

const SEG: Record<Segment, { icon: IconName; label: string }> = {
  paid: { icon: 'coins', label: 'BID' },
  free: { icon: 'vote', label: 'VOTES' },
};

export type StatSize = 'sm' | 'md' | 'lg' | 'hero';

export interface StatBlockProps {
  segment?: Segment;
  /** Очки для paid, голоса для free. */
  value: number;
  currency?: DisplayCurrency;
  /** null убирает подпись, undefined берёт подпись сегмента. */
  label?: string | null;
  size?: StatSize;
  align?: 'left' | 'right';
  delta?: number;
  compact?: boolean;
  showIcon?: boolean;
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function StatBlock({
  segment = 'paid',
  value,
  currency = 'UZS',
  label,
  size = 'md',
  align = 'right',
  delta,
  compact,
  showIcon = false,
  inline = false,
  className,
  style,
}: StatBlockProps) {
  const seg = SEG[segment];
  const isPaid = segment === 'paid';

  const text = isPaid
    ? formatMoney(value, { currency, compact })
    : formatVotes(value, { compact: compact ?? true });
  const unit = isPaid ? CURRENCY_SUFFIX[currency] : 'votes';

  const d = Number(delta) || 0;

  return (
    <div
      data-segment={segment}
      data-size={size}
      data-align={align}
      data-inline={inline}
      className={cx(styles.stat, className)}
      style={style}
    >
      {label !== null && <span className={styles.caption}>{label ?? seg.label}</span>}

      <span className={styles.amount}>
        {showIcon && (
          <Icon
            name={seg.icon}
            size={size === 'sm' ? 13 : 15}
            color="var(--stat-accent)"
            style={{ alignSelf: 'center' }}
          />
        )}
        <span className={styles.value}>{text}</span>
        <span className={styles.unit}>{unit}</span>
      </span>

      {d !== 0 && (
        <span data-dir={d > 0 ? 'up' : 'down'} className={styles.delta}>
          <Icon name={d > 0 ? 'arrow-up' : 'arrow-down'} size={9} />
          {isPaid
            ? formatMoney(Math.abs(d), { currency, compact: true })
            : formatVotes(Math.abs(d))}
        </span>
      )}
    </div>
  );
}
