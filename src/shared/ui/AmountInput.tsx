import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { CURRENCY_SUFFIX, group, type DisplayCurrency } from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import styles from './AmountInput.module.css';

export type AmountSegment = 'paid' | 'free' | 'attack';

export interface AmountInputProps {
  value: number;
  onChange?: (value: number) => void;
  segment?: AmountSegment;
  currency?: DisplayCurrency;
  /** Переопределяет единицу — например, звёзды вместо сумов. */
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  presets?: number[];
  balance?: number;
  balanceLabel?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function AmountInput({
  value,
  onChange,
  segment = 'paid',
  currency = 'UZS',
  unit,
  step = 10_000,
  min = 0,
  max,
  presets = [],
  balance,
  balanceLabel = 'Баланс',
  label = 'Сумма',
  error,
  disabled = false,
  className,
  style,
}: AmountInputProps) {
  const suffix = unit ?? (segment === 'free' ? 'votes' : CURRENCY_SUFFIX[currency]);

  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n);
  const set = (n: number) => {
    if (!disabled) onChange?.(clamp(Math.round(n)));
  };

  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div
      data-segment={segment}
      data-error={Boolean(error)}
      data-disabled={disabled}
      className={cx(styles.field, className)}
      style={style}
    >
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {balance !== undefined && (
          <span className={styles.balance}>
            {balanceLabel} <span className={styles.balanceValue}>{group(balance)}</span> {suffix}
          </span>
        )}
      </div>

      <div className={styles.control}>
        <StepButton icon="minus" onClick={() => set(value - step)} disabled={disabled || atMin} />

        <div className={styles.value}>
          <input
            inputMode="numeric"
            className={styles.input}
            value={group(value ?? 0)}
            disabled={disabled}
            onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 0)}
          />
          <span className={styles.suffix}>{suffix}</span>
        </div>

        <StepButton
          icon="plus"
          accent
          onClick={() => set(value + step)}
          disabled={disabled || atMax}
        />
      </div>

      {presets.length > 0 && (
        <div className={styles.presets}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.preset}
              disabled={disabled}
              onClick={() => set((value || 0) + preset)}
            >
              +{group(preset)}
            </button>
          ))}
          {max !== undefined && (
            <button
              type="button"
              data-accent="true"
              className={styles.preset}
              disabled={disabled}
              onClick={() => set(max)}
            >
              MAX
            </button>
          )}
        </div>
      )}

      {error && (
        <span className={styles.error}>
          <Icon name="info" size={13} />
          {error}
        </span>
      )}
    </div>
  );
}

function StepButton({
  icon,
  onClick,
  disabled,
  accent = false,
}: {
  icon: IconName;
  onClick: () => void;
  disabled: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      data-accent={accent}
      className={styles.step}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
