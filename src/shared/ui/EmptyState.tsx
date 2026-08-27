import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { Button, type ButtonVariant } from './Button';
import { cx } from '@/shared/lib/cx';
import styles from './EmptyState.module.css';

type EmptySegment = 'neutral' | 'paid' | 'free';

const ACTION_VARIANT: Record<EmptySegment, ButtonVariant> = {
  neutral: 'secondary',
  paid: 'paid',
  free: 'free',
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
  className?: string;
  style?: CSSProperties;
}

export function EmptyState({
  icon = 'search-x',
  title,
  description,
  actionLabel,
  onAction,
  segment = 'neutral',
  compact = false,
  className,
  style,
}: EmptyStateProps) {
  return (
    <div
      data-segment={segment}
      data-compact={compact}
      className={cx(styles.empty, className)}
      style={style}
    >
      <span className={styles.badge}>
        <Icon name={icon} size={22} />
      </span>

      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>

      {actionLabel && (
        <Button variant={ACTION_VARIANT[segment]} size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
