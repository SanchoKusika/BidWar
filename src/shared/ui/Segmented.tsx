import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Segmented.module.css';

export type SegmentedOption = string | { value: string; label: string };

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  segment?: 'paid' | 'free';
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

export function Segmented({
  options,
  value,
  onChange,
  segment = 'paid',
  size = 'md',
  className,
  style,
}: SegmentedProps) {
  return (
    <div
      role="tablist"
      data-segment={segment}
      data-size={size}
      className={cx(styles.group, className)}
      style={style}
    >
      {options.map((option) => {
        const optionValue = typeof option === 'string' ? option : option.value;
        const optionLabel = typeof option === 'string' ? option : option.label;

        return (
          <button
            key={optionValue}
            type="button"
            role="tab"
            aria-selected={optionValue === value}
            className={styles.option}
            onClick={() => onChange?.(optionValue)}
          >
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}
