import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './ActivityFeed.module.css';

export type ActivityKind = 'raise' | 'attack' | 'votes' | 'entered';

/** Иконка и знак суммы: атака всегда со знаком минус — это чужая потеря. */
const KIND: Record<ActivityKind, { icon: IconName; sign: string }> = {
  raise: { icon: 'chevrons-up', sign: '+' },
  attack: { icon: 'swords', sign: '−' },
  votes: { icon: 'vote', sign: '+' },
  entered: { icon: 'sparkles', sign: '' },
};

export interface ActivityItem {
  id?: string;
  kind: ActivityKind;
  name: string;
  /** Уже отформатированная сумма. */
  amount: string;
  unit?: string;
  /** Позиция после события. */
  rank?: number;
  /** Человеческое «сколько назад» — «2 мин». */
  ago: string;
}

export interface ActivityFeedProps {
  items?: ActivityItem[];
  title?: string;
  right?: ReactNode;
  /** Плотность мини-аппа. */
  dense?: boolean;
  max?: number;
  onItem?: (item: ActivityItem) => void;
  className?: string;
  style?: CSSProperties;
}

export function ActivityFeed({
  items = [],
  title,
  right,
  dense = false,
  max,
  onItem,
  className,
  style,
}: ActivityFeedProps) {
  const rows = max ? items.slice(0, max) : items;

  return (
    <section data-dense={dense} className={cx(styles.feed, className)} style={style}>
      {(title || right) && (
        <div className={styles.head}>
          {title && <span className={styles.title}>{title}</span>}
          {right}
        </div>
      )}

      <div className={styles.list}>
        {rows.map((item, i) => {
          const kind = KIND[item.kind];

          return (
            <div
              key={item.id ?? i}
              data-kind={item.kind}
              className={styles.row}
              role={onItem ? 'button' : undefined}
              onClick={onItem ? () => onItem(item) : undefined}
            >
              <span className={styles.badge}>
                <Icon name={kind.icon} size={dense ? 12 : 14} />
              </span>

              <span className={styles.body}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.meta}>
                  {item.rank !== undefined ? `→ #${item.rank} · ` : ''}
                  {item.ago}
                </span>
              </span>

              <span className={styles.amount}>
                {kind.sign}
                {item.amount}
                {item.unit && <span className={styles.unit}>{item.unit}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
