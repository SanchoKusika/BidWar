import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';

export type TabId = 'paid' | 'free' | 'tasks' | 'profile';

interface Tab {
  id: TabId;
  label: string;
  icon: IconName;
  accent: string;
  tint: string;
}

const TABS: Tab[] = [
  {
    id: 'paid',
    label: 'Paid',
    icon: 'coins',
    accent: 'var(--paid-accent)',
    tint: 'var(--paid-tint)',
  },
  {
    id: 'free',
    label: 'Free',
    icon: 'vote',
    accent: 'var(--free-accent)',
    tint: 'var(--free-tint)',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'list-checks',
    accent: 'var(--text-primary)',
    tint: 'var(--surface-sunken)',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'user',
    accent: 'var(--text-primary)',
    tint: 'var(--surface-sunken)',
  },
];

export interface TabBarProps {
  active?: TabId;
  onChange?: (id: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
  floating?: boolean;
  style?: CSSProperties;
}

/**
 * Нижняя навигация мини-аппа. Paid и Free — две витрины, у каждой свой акцент:
 * активный таб и есть сигнал, в какой экономике ты находишься.
 *
 * Единственный фиксированный элемент интерфейса. В вебе его место занимает
 * верхняя навигация, поэтому компонент живёт в мобильной оболочке.
 */
export function TabBar({
  active = 'paid',
  onChange,
  badges = {},
  floating = true,
  style,
}: TabBarProps) {
  return (
    <nav
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: floating
          ? '0 var(--page-gutter) calc(var(--space-6) + env(safe-area-inset-bottom, 0px))'
          : 0,
        background: floating ? 'transparent' : 'var(--bg-elevated)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TABS.length},1fr)`,
          width: '100%',
          maxWidth: 'var(--page-max)',
          height: 'var(--tabbar-h)',
          padding: 'var(--space-3)',
          gap: 'var(--space-1)',
          background: 'var(--surface-card)',
          border: 'var(--border-w) solid var(--border-subtle)',
          borderRadius: floating ? 'var(--radius-xl)' : 0,
          boxShadow: floating ? 'var(--shadow-tabbar)' : 'none',
          backdropFilter: 'var(--blur-chrome)',
        }}
      >
        {TABS.map((t) => {
          const on = active === t.id;
          const badge = badges[t.id];

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange?.(t.id)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: 'var(--hit-min)',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                background: on ? t.tint : 'transparent',
                color: on ? t.accent : 'var(--text-muted)',
                transition: 'var(--t-control)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Icon name={t.icon} size={20} />
              <span
                style={{
                  font: 'var(--type-label)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-10)',
                  letterSpacing: 'var(--ls-wide)',
                  textTransform: 'uppercase',
                  fontWeight: on ? 800 : 600,
                }}
              >
                {t.label}
              </span>

              {badge ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: '50%',
                    marginRight: -20,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-pill)',
                    background: t.id === 'tasks' ? 'var(--free-accent)' : 'var(--attack-accent)',
                    color: '#fff',
                    font: 'var(--type-label)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
