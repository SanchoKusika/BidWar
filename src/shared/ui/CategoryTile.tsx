import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import type { Segment } from './OgPreview';
import styles from './CategoryTile.module.css';

export interface CategoryTileProps {
  name: string;
  icon?: IconName;
  segment?: Segment;
  /** Общий пул категории, уже отформатированный вызывающим кодом. */
  pool: string;
  unit?: string;
  projects?: number;
  /** Кто держит вершину категории. */
  leader?: string;
  active?: boolean;
  onPress?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function CategoryTile({
  name,
  icon = 'folder',
  segment = 'paid',
  pool,
  unit,
  projects,
  leader,
  active = false,
  onPress,
  className,
  style,
}: CategoryTileProps) {
  return (
    <button
      type="button"
      data-segment={segment}
      data-active={active}
      data-pressable={Boolean(onPress)}
      className={cx(styles.tile, className)}
      style={style}
      onClick={onPress}
    >
      <span className={styles.head}>
        <span className={styles.badge}>
          <Icon name={icon} size={14} />
        </span>
        <span className={styles.name}>{name}</span>
        {projects !== undefined && <span className={styles.count}>{projects}</span>}
      </span>

      <span className={styles.pool}>
        <span className={styles.poolValue}>{pool}</span>
        {unit && <span className={styles.poolUnit}>{unit}</span>}
      </span>

      {leader && (
        <span className={styles.leader}>
          <Icon name="crown" size={12} color="var(--medal-1-line)" />
          <span className={styles.leaderName}>{leader}</span>
        </span>
      )}
    </button>
  );
}
