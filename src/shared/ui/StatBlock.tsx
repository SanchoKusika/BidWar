import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import {
  CURRENCY_SUFFIX,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import type { Segment } from './OgPreview';

interface SegmentSpec {
  color: string;
  accent: string;
  icon: IconName;
  label: string;
}

const SEG: Record<Segment, SegmentSpec> = {
  paid: { color: 'var(--paid-amount)', accent: 'var(--paid-accent)', icon: 'coins', label: 'BID' },
  free: { color: 'var(--free-amount)', accent: 'var(--free-accent)', icon: 'vote', label: 'VOTES' },
};

type StatSize = 'sm' | 'md' | 'lg' | 'hero';

const FS: Record<StatSize, { amount: string; unit: string }> = {
  sm: { amount: 'var(--type-amount-sm)', unit: 'var(--fs-10)' },
  md: { amount: 'var(--type-amount-md)', unit: 'var(--fs-11)' },
  lg: { amount: 'var(--type-amount-lg)', unit: 'var(--fs-12)' },
  hero: { amount: 'var(--type-amount-hero)', unit: 'var(--fs-13)' },
};

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
  style?: CSSProperties;
}

/**
 * Числовой блок ранжированной строки: деньги в Paid, голоса в Free — никогда
 * оба сразу. Сегмент задаёт цвет, единицу и подпись; единица обязательна,
 * потому что голое число позволяет спутать две экономики.
 */
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
  style,
}: StatBlockProps) {
  const s = SEG[segment];
  const f = FS[size];

  const text =
    segment === 'paid'
      ? formatMoney(value, { currency, compact })
      : formatVotes(value, { compact: compact ?? true });
  const unit = segment === 'paid' ? CURRENCY_SUFFIX[currency] : 'votes';
  const d = Number(delta) || 0;

  const caption = label !== null && (
    <span
      style={{
        font: 'var(--type-label)',
        letterSpacing: 'var(--ls-caps)',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}
    >
      {label ?? s.label}
    </span>
  );

  const amount = (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
      {showIcon && (
        <Icon
          name={s.icon}
          size={size === 'sm' ? 13 : 15}
          color={s.accent}
          style={{ alignSelf: 'center' }}
        />
      )}
      <span
        style={{
          font: f.amount,
          color: s.color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 'var(--ls-tighter)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
      <span
        style={{
          font: 'var(--type-micro)',
          fontSize: f.unit,
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {unit}
      </span>
    </span>
  );

  const deltaChip = Boolean(d) && (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
        padding: '1px 5px',
        borderRadius: 'var(--radius-pill)',
        background: d > 0 ? 'var(--free-tint)' : 'var(--attack-tint)',
        color: d > 0 ? 'var(--delta-up)' : 'var(--delta-down)',
        font: 'var(--type-label)',
      }}
    >
      <Icon name={d > 0 ? 'arrow-up' : 'arrow-down'} size={9} />
      {segment === 'paid'
        ? formatMoney(Math.abs(d), { currency, compact: true })
        : formatVotes(Math.abs(d))}
    </span>
  );

  if (inline) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-4)',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          ...style,
        }}
      >
        {caption}
        {amount}
        {deltaChip}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 2,
        ...style,
      }}
    >
      {caption}
      {amount}
      {deltaChip}
    </div>
  );
}
