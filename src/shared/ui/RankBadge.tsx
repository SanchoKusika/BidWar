import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './RankBadge.module.css';

const MEDAL_NAMES: Record<number, string> = { 1: 'Золото', 2: 'Серебро', 3: 'Бронза' };

export interface RankBadgeProps {
  rank: number;
  /** Изменение позиции с прошлого просмотра. */
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
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
  delta = 0,
  size = 'md',
  showDelta = true,
  className,
  style,
}: RankBadgeProps) {
  const medal = rank >= 1 && rank <= 3 ? rank : undefined;
  const d = Number(delta) || 0;
  const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';

  return (
    <div data-size={size} className={cx(styles.badge, className)} style={style}>
      <div
        data-medal={medal}
        className={styles.chip}
        title={medal ? `${MEDAL_NAMES[medal]} — место ${rank}` : undefined}
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

      {showDelta && (
        <span data-dir={dir} className={styles.delta}>
          {d !== 0 && <Icon name={d > 0 ? 'arrow-up' : 'arrow-down'} size={9} />}
          {d === 0 ? '—' : Math.abs(d)}
        </span>
      )}
    </div>
  );
}
