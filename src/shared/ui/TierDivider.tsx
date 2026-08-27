import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './TierDivider.module.css';

export interface TierDividerProps {
  label: string;
  /** Цена входа в ярус — например, «от 500 000 сум». */
  note?: string;
  icon?: IconName;
  tone?: string;
  className?: string;
  style?: CSSProperties;
}

export function TierDivider({ label, note, icon, tone, className, style }: TierDividerProps) {
  return (
    <div
      className={cx(styles.divider, className)}
      style={{ ...(tone ? { '--tier-tone': tone } : {}), ...style } as CSSProperties}
    >
      <span className={styles.label}>
        {icon && <Icon name={icon} size={11} />}
        {label}
      </span>
      <span className={styles.rule} />
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}
