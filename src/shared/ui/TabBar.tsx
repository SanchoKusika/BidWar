import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './TabBar.module.css';

export type TabId = 'paid' | 'free' | 'tasks' | 'profile';

const TABS: Array<{ id: TabId; label: string; icon: IconName }> = [
  { id: 'paid', label: 'Paid', icon: 'coins' },
  { id: 'free', label: 'Free', icon: 'vote' },
  { id: 'tasks', label: 'Tasks', icon: 'list-checks' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export interface TabBarProps {
  active?: TabId;
  onChange?: (id: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
  floating?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function TabBar({
  active = 'paid',
  onChange,
  badges = {},
  floating = true,
  className,
  style,
}: TabBarProps) {
  return (
    <nav data-floating={floating} className={cx(styles.bar, className)} style={style}>
      <div className={styles.inner}>
        {TABS.map((tab) => {
          const badge = badges[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              data-tab={tab.id}
              aria-current={active === tab.id ? 'page' : undefined}
              className={styles.tab}
              onClick={() => onChange?.(tab.id)}
            >
              <Icon name={tab.icon} size={20} />
              <span className={styles.label}>{tab.label}</span>
              {badge ? <span className={styles.badge}>{badge}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
