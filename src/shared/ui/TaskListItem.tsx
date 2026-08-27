import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { group } from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import styles from './TaskListItem.module.css';

export type TaskState = 'available' | 'pending' | 'done' | 'locked';

/** Подпись справа. У доступного задания её нет — там шеврон. */
const STATUS_LABEL: Partial<Record<TaskState, string>> = {
  pending: 'Проверяем',
  done: 'Готово',
  locked: 'Закрыто',
};

export interface TaskListItemProps {
  title: string;
  subtitle?: string;
  /** Награда в голосах. */
  reward: number;
  icon?: IconName;
  state?: TaskState;
  progress?: { current: number; total: number };
  onPress?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function TaskListItem({
  title,
  subtitle,
  reward,
  icon = 'circle-check-big',
  state = 'available',
  progress,
  onPress,
  className,
  style,
}: TaskListItemProps) {
  const interactive = state === 'available' && Boolean(onPress);
  const status = STATUS_LABEL[state];

  return (
    <div
      data-state={state}
      data-interactive={interactive}
      className={cx(styles.task, className)}
      style={style}
      onClick={interactive ? onPress : undefined}
    >
      <div className={styles.badge}>
        <Icon name={state === 'done' ? 'check' : icon} size={20} />
      </div>

      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}

        {progress && (
          <div className={styles.progress}>
            <div className={styles.track}>
              <div
                className={styles.fill}
                style={
                  {
                    '--progress': `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                  } as CSSProperties
                }
              />
            </div>
            <span className={styles.progressLabel}>
              {progress.current}/{progress.total}
            </span>
          </div>
        )}
      </div>

      <div className={styles.trailing}>
        <span className={styles.reward}>
          <Icon name="vote" size={13} />
          <span className={styles.rewardValue}>+{group(reward)}</span>
        </span>
        {status ? (
          <span className={styles.status}>{status}</span>
        ) : (
          <Icon name="chevron-right" size={16} color="var(--text-muted)" />
        )}
      </div>
    </div>
  );
}
