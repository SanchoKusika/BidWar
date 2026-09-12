import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { SkeletonText } from './Skeleton';
import {
  CURRENCY_SUFFIX,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import { strings } from '@/shared/i18n/strings';
import type { Segment } from './OgPreview';
import styles from './StatBlock.module.css';

// Functions, not strings: a record built at module level keeps the language of
// the first launch. The proxy in `strings` is read per access, so calling it at
// render is what makes the caption follow the switch.
const SEG: Record<Segment, { icon: IconName; label: () => string }> = {
  paid: { icon: 'coins', label: () => strings.own.bidShort },
  free: { icon: 'vote', label: () => strings.own.votesShort },
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
  /**
   * Единицу можно убрать ровно в одном случае: когда её уже назвала подпись
   * («ТВОИ ГОЛОСА» над числом, а под ним ещё раз «голосов»). Правило «число
   * всегда идёт со своей единицей» при этом не нарушается — единица на экране
   * остаётся, просто один раз. Для денег так делать нельзя никогда: подпись
   * говорит «ставка», а не в какой валюте.
   */
  showUnit?: boolean;
  showIcon?: boolean;
  inline?: boolean;
  /** The number is not known yet: caption and unit stay, the value is a placeholder. */
  loading?: boolean;
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
  showUnit = true,
  showIcon = false,
  inline = false,
  loading = false,
  className,
  style,
}: StatBlockProps) {
  const seg = SEG[segment];
  const isPaid = segment === 'paid';

  const text = isPaid
    ? formatMoney(value, { currency, compact })
    : formatVotes(value, { compact: compact ?? true });
  // Read at render, like the caption above it: a module-level value would
  // keep the language of the first launch, and this unit sits right under a
  // caption that does not.
  const unit = isPaid ? CURRENCY_SUFFIX[currency] : strings.vote.unit;

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
      {label !== null && <span className={styles.caption}>{label ?? seg.label()}</span>}

      <span className={styles.amount}>
        {showIcon && (
          <Icon
            name={seg.icon}
            size={size === 'sm' ? 13 : 15}
            color="var(--stat-accent)"
            style={{ alignSelf: 'center' }}
          />
        )}
        <span className={styles.value}>
          {loading ? <SkeletonText>{isPaid ? '000 000' : '000'}</SkeletonText> : text}
        </span>
        {showUnit && <span className={styles.unit}>{unit}</span>}
      </span>

      {!loading && d !== 0 && (
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
