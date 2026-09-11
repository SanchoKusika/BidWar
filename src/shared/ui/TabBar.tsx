import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import { strings } from '@/shared/i18n/strings';
import { haptic } from '@/shared/lib/haptic';
import styles from './TabBar.module.css';

export type TabId = 'paid' | 'free' | 'tasks' | 'profile';

// Функция, а не константа: подписи читаются в момент отрисовки, иначе после
// смены языка в меню осталась бы вчерашняя (та же причина, что у themeOptions).
const tabs = (): Array<{ id: TabId; label: string; icon: IconName }> => [
  { id: 'paid', label: strings.tabs.paid, icon: 'coins' },
  { id: 'free', label: strings.tabs.free, icon: 'vote' },
  { id: 'tasks', label: strings.tabs.tasks, icon: 'list-checks' },
  { id: 'profile', label: strings.tabs.profile, icon: 'user' },
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
        {tabs().map((tab) => {
          const badge = badges[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              data-tab={tab.id}
              aria-current={active === tab.id ? 'page' : undefined}
              className={styles.tab}
              onClick={() => {
                // Отклик на смену вкладки — это не «нажал кнопку, ничего не
                // случилось»: экран под пальцем меняется сразу, и короткий
                // щелчок подтверждает именно переключение. Повторное нажатие
                // активной вкладки ничего не меняет, поэтому и молчит.
                if (tab.id !== active) haptic('selection');
                onChange?.(tab.id);
              }}
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
