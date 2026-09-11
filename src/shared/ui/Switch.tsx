import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import { haptic } from '@/shared/lib/haptic';
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
      onClick={() => {
        // Сначала переключаем, потом отзываемся — порядок здесь не вкусовой.
        // `haptic` спрашивает настройку вибрации, а этим же тумблером её и
        // выключают: при обратном порядке выключение ещё дёргало телефон, а
        // включение молчало — ровно наоборот тому, что человек только что
        // попросил.
        onChange?.(!checked);
        haptic('selection');
      }}
    >
      <span className={styles.knob} />
    </button>
  );
}
