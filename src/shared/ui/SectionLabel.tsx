import type { ReactNode } from 'react';
import styles from './SectionLabel.module.css';

export interface SectionLabelProps {
  children: ReactNode;
  /** Действие или счётчик у правого края строки. */
  right?: ReactNode;
}

/**
 * Заголовок секции над лентой или группой заданий
 * (design/ui_kits/mini_app/Shell.jsx). Сам держит боковые поля страницы,
 * поэтому его кладут в колонку без внешнего padding.
 */
export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{children}</span>
      {right}
    </div>
  );
}
