import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { Button, type ButtonVariant } from './Button';

type EmptySegment = 'neutral' | 'paid' | 'free';

const SEG: Record<EmptySegment, { tint: string; fg: string; variant: ButtonVariant }> = {
  neutral: { tint: 'var(--surface-sunken)', fg: 'var(--text-muted)', variant: 'secondary' },
  paid: { tint: 'var(--paid-tint)', fg: 'var(--paid-accent)', variant: 'paid' },
  free: { tint: 'var(--free-tint)', fg: 'var(--free-accent)', variant: 'free' },
};

export interface EmptyStateProps {
  icon?: IconName;
  /** Что отсутствует. */
  title: string;
  /** Что с этим делать. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  segment?: EmptySegment;
  compact?: boolean;
  style?: CSSProperties;
}

/**
 * Пустое состояние ленты, списка заданий или поиска. Две строки: что
 * отсутствует, затем что сделать. Только текст — иллюстраций в бренде нет.
 */
export function EmptyState({
  icon = 'search-x',
  title,
  description,
  actionLabel,
  onAction,
  segment = 'neutral',
  compact = false,
  style,
}: EmptyStateProps) {
  const s = SEG[segment];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-5)',
        padding: compact ? 'var(--space-12) var(--space-8)' : 'var(--space-20) var(--space-8)',
        background: 'var(--surface-card)',
        border: '1px dashed var(--border-default)',
        borderRadius: 'var(--radius-card)',
        ...style,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          background: s.tint,
          color: s.fg,
        }}
      >
        <Icon name={icon} size={22} />
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 280 }}>
        <span style={{ font: 'var(--type-section)', color: 'var(--text-primary)' }}>{title}</span>
        {description && (
          <span
            style={{
              font: 'var(--type-caption)',
              color: 'var(--text-secondary)',
              textWrap: 'pretty',
            }}
          >
            {description}
          </span>
        )}
      </div>

      {actionLabel && (
        <Button variant={s.variant} size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
