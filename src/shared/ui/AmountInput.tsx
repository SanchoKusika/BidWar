import { useState, type CSSProperties, type PointerEvent } from 'react';
import { Icon, type IconName } from './Icon';
import {
  CURRENCY_SUFFIX,
  formatEditable,
  fromDisplay,
  group,
  type DisplayCurrency,
  DEFAULT_CURRENCY,
} from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import { strings } from '@/shared/i18n/strings';
import { haptic } from '@/shared/lib/haptic';
import styles from './AmountInput.module.css';

export type AmountSegment = 'paid' | 'free' | 'attack';

export interface AmountInputProps {
  /**
   * Сумма в ОЧКАХ — в них считает сервер, и наружу поле отдаёт их же. Человеку
   * она показывается в валюте показа (04 Платежи и валюты: «очки,
   * отрендеренные в валюте зрителя»), пересчёт живёт целиком внутри поля.
   */
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
  currency = DEFAULT_CURRENCY,
  unit,
  step = 10_000,
  min = 0,
  max,
  presets = [],
  balance,
  balanceLabel = strings.card.balance,
  label = strings.card.amount,
  error,
  disabled = false,
  className,
  style,
}: AmountInputProps) {
  const suffix = unit ?? (segment === 'free' ? 'votes' : CURRENCY_SUFFIX[currency]);
  /**
   * Голоса и звёзды — не деньги и не конвертируются: у голосов своя экономика,
   * а свою единицу вызывающий задаёт `unit`, и пересчитывать её по курсу сумов
   * было бы прямой ошибкой.
   */
  const converts = segment !== 'free' && unit === undefined;

  const clampMax = (n: number) => (max !== undefined ? Math.min(max, n) : n);
  const clamp = (n: number) => Math.max(min, clampMax(n));

  /**
   * What the person is typing, while the field has focus. Without it every
   * keystroke went through `clamp`, so the field could never hold less than
   * the minimum: erasing «300» to type «301» snapped straight back to 300.
   * While typing, only the maximum applies; the minimum is shown as an error
   * by the caller and enforced when the field loses focus.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const set = (n: number) => {
    if (disabled) return;
    setDraft(null);
    onChange?.(clamp(Math.round(n)));
  };

  /**
   * То же, что `set`, но с откликом — и только когда число правда сдвинулось.
   * Пресет, нажатый на уже максимальной сумме, упирается в `clamp`: вибрация
   * там сообщила бы о событии, которого не произошло.
   */
  const nudge = (n: number) => {
    if (clamp(Math.round(n)) !== value) haptic('selection');
    set(n);
  };

  const show = (points: number) => (converts ? formatEditable(points, currency) : group(points));

  /**
   * Разбор набранного. Шаг, минимум и пресеты приходят в очках и остаются
   * точными, поэтому доля, потерянная на округлении копеек, не может увести
   * сумму ниже минимума: `clamp` поднимет её обратно.
   */
  const parse = (raw: string): number => {
    if (!converts) return Number(raw.replace(/\D/g, '')) || 0;
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    return fromDisplay(Number.parseFloat(cleaned) || 0, currency);
  };

  const type = (raw: string) => {
    const digits = raw.replace(converts ? /[^\d.,]/g : /\D/g, '');
    const next = clampMax(parse(digits));
    setDraft(digits === '' ? '' : show(next));
    onChange?.(next);
  };

  const commit = () => {
    setDraft(null);
    if (value < min) onChange?.(min);
  };

  // Steppers and presets must not take focus from the field: a blur would
  // commit the half-typed number first and the tap would add to a stale one.
  const keepFocus = (e: PointerEvent) => e.preventDefault();

  const text = draft ?? show(value ?? 0);
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
            {balanceLabel} <span className={styles.balanceValue}>{show(balance)}</span> {suffix}
          </span>
        )}
      </div>

      <div className={styles.control}>
        <StepButton
          icon="minus"
          onClick={() => set(value - step)}
          onPointerDown={keepFocus}
          disabled={disabled || atMin}
        />

        {/* A label, so a tap on the unit focuses the number too. */}
        <label className={styles.value} data-long={text.length > 7}>
          {/* The input sizes itself to its text through a hidden twin in the
              same grid cell: a fixed-width input left the number off-centre
              against the unit next to it. */}
          <span className={styles.fit}>
            <span className={styles.sizer} aria-hidden="true">
              {text || '0'}
            </span>
            <input
              inputMode="numeric"
              enterKeyHint="done"
              className={styles.input}
              value={text}
              placeholder="0"
              disabled={disabled}
              onFocus={(e) => {
                setDraft(show(value ?? 0));
                e.currentTarget.select();
              }}
              onChange={(e) => type(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </span>
          <span className={styles.suffix}>{suffix}</span>
        </label>

        <StepButton
          icon="plus"
          accent
          onClick={() => set(value + step)}
          onPointerDown={keepFocus}
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
              onPointerDown={keepFocus}
              onClick={() => {
                // Отклик только если число правда сдвинулось: пресет на уже
                // максимальной сумме ничего не меняет, и вибрация там означала
                // бы событие, которого не было.
                nudge((value || 0) + preset);
              }}
            >
              +{show(preset)}
            </button>
          ))}
          {max !== undefined && (
            <button
              type="button"
              data-accent="true"
              className={styles.preset}
              disabled={disabled}
              onPointerDown={keepFocus}
              onClick={() => nudge(max)}
            >
              {strings.common.max}
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
  onPointerDown,
  disabled,
  accent = false,
}: {
  icon: IconName;
  onClick: () => void;
  onPointerDown: (e: PointerEvent) => void;
  disabled: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      data-accent={accent}
      className={styles.step}
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
