import type { MouseEvent, ReactNode } from 'react';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Оболочка нижней шторки: скрим + закруглённая панель + грабер. Единственный
 * модальный паттерн в системе — ни центрированных диалогов, ни тостов
 * (07 Экраны.md, «Layout rules»).
 */
export function Sheet({ open, onClose, children }: SheetProps) {
  if (!open) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.panel} onClick={stop}>
        <span className={styles.grabber} />
        {children}
      </div>
    </div>
  );
}
