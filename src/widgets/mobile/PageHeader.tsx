import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { ShowcaseType } from '@/entities/project';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  segment?: ShowcaseType;
  title: string;
  meta?: string;
  right?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
}

/** Самый сильный сигнал «на каком я топе» — тонированная шапка страницы. */
export function PageHeader({ segment, title, meta, right, action, onBack }: PageHeaderProps) {
  return (
    <header data-segment={segment} className={styles.header}>
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Назад" className={styles.back}>
          <Icon name="arrow-left" size={16} />
        </button>
      )}

      <div className={styles.body}>
        {(segment || action) && (
          <div className={styles.top}>
            {segment && <span className={styles.pill}>{segment === 'free' ? 'FREE' : 'PAID'}</span>}
            {action}
          </div>
        )}
        <h1 className={styles.title}>{title}</h1>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>

      {right}
    </header>
  );
}
