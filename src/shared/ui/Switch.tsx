import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Switch.module.css';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  segment?: 'paid' | 'free' | 'attack';
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  segment = 'paid',
  label,
  className,
  style,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-segment={segment}
      disabled={disabled}
      className={cx(styles.switch, className)}
      style={style}
      onClick={() => onChange?.(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
