import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { cx } from '@/shared/lib/cx';
import { strings } from '@/shared/i18n/strings';
import styles from './RankBadge.module.css';

const t = strings.card;

// Подпись медали видна во всплывающей подсказке и читается программами чтения
// с экрана — значит переводится, а не остаётся русской константой.
function medalName(medal: number): string | undefined {
  if (medal === 1) return t.medalGold;
  if (medal === 2) return t.medalSilver;
  if (medal === 3) return t.medalBronze;
  return undefined;
}

export interface RankBadgeProps {
  rank: number;
  /**
   * Изменение позиции: положительное — поднялся, отрицательное — упал, 0 —
   * «сравнили и не изменилось». Не передан ⇒ сравнивать не с чем, и строки под
   * бейджем нет вовсе.
   *
   * Сегодня его не передаёт никто: истории рангов в схеме нет ни в каком виде
   * (нужен снапшот позиций, отдельная таблица — см. [[12 Состояние
   * реализации]]). До неё прочерк под КАЖДЫМ бейджем врал, что изменение
   * посчитано и равно нулю, хотя не считалось вообще.
   */
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Явно скрыть изменение, даже когда оно известно. */
  showDelta?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Позиция в топе. Первые три места оформлены как медали — вся их анимация и
 * металл описаны в стилях, здесь остаётся только выбор места.
 */
export function RankBadge({
  rank,
  delta,
  size = 'md',
  showDelta = true,
  className,
  style,
}: RankBadgeProps) {
  const medal = rank >= 1 && rank <= 3 ? rank : undefined;
  const d = delta === undefined ? null : Number(delta) || 0;
  const dir = d === null ? 'flat' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';

  return (
    <div data-size={size} className={cx(styles.badge, className)} style={style}>
      <div
        data-medal={medal}
        className={styles.chip}
        title={medal ? `${medalName(medal)} · #${rank}` : undefined}
      >
        {medal !== undefined && (
          <>
            <span aria-hidden="true" className={styles.halo} />
            <span aria-hidden="true" className={cx(styles.flame, styles.body)} />
            <span aria-hidden="true" className={cx(styles.flame, styles.core)} />
          </>
        )}
        <span className={styles.digit}>{rank}</span>
      </div>

      {showDelta && d !== null && (
        <span data-dir={dir} className={styles.delta}>
          {d !== 0 && <Icon name={d > 0 ? 'arrow-up' : 'arrow-down'} size={9} />}
          {d === 0 ? '—' : Math.abs(d)}
        </span>
      )}
    </div>
  );
}
