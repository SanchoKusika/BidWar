import type { ShowcaseType } from '@/entities/project';
import { strings } from '@/shared/i18n/strings';
import styles from './ScopeToggle.module.css';

/** `today` — доска последних 24 часов, `all` — за всё время. */
export type Scope = 'all' | 'today';

export interface ScopeToggleProps {
  value: Scope;
  onChange: (scope: Scope) => void;
  segment: ShowcaseType;
}

/**
 * Переключатель «за всё время / за сутки» в шапке ленты
 * (design/ui_kits/mini_app/TopFeed.jsx). Суточная доска — это второй, дешёвый
 * вход: новый проект может выиграть день за небольшие деньги и при этом быть
 * нигде в общем зачёте.
 */
export function ScopeToggle({ value, onChange, segment }: ScopeToggleProps) {
  return (
    <span className={styles.wrap}>
      {(['all', 'today'] as const).map((scope) => (
        <button
          key={scope}
          type="button"
          className={styles.option}
          data-segment={segment}
          data-active={value === scope}
          onClick={() => onChange(scope)}
        >
          {scope === 'all' ? strings.showcase.allTime : strings.showcase.today}
        </button>
      ))}
    </span>
  );
}
