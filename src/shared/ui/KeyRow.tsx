import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './KeyRow.module.css';

/** Смысловая окраска значения, а не произвольный цвет: тон несёт экономику. */
export type KeyRowTone = 'paid' | 'free' | 'attack' | 'up' | 'down';

export interface KeyRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Крупное табличное начертание — для итоговой строки блока. */
  strong?: boolean;
  tone?: KeyRowTone;
  className?: string;
}

/**
 * Строка «подпись — значение» из дизайн-кита (design/ui_kits/mini_app/Shell.jsx).
 * Единственный способ показать пару фактов в шторках, на странице проекта и в
 * правилах: значение всегда табличными цифрами, чтобы столбец не «плясал».
 */
export function KeyRow({ label, value, strong = false, tone, className }: KeyRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} data-strong={strong} data-tone={tone}>
        {value}
      </span>
    </div>
  );
}
