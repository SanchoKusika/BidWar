import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './ScreenLayout.module.css';

/* Каркас экрана из дизайн-кита: под шапкой идёт колонка секций с общим
   вертикальным ритмом, а боковые поля держит не она, а каждый блок сам —
   так ленты и чипы могут скроллиться от края до края. */

/** Колонка секций под PageHeader. */
export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

/** Боковые поля страницы для блоков, которым не нужен скролл до края. */
export function Gutter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.gutter, className)}>{children}</div>;
}

/** Секция с заголовком и своим внутренним ритмом. */
export function Section({ children }: { children: ReactNode }) {
  return <div className={styles.section}>{children}</div>;
}

/** Карточка-панель: описание проекта, разбор правила. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx(styles.card, className)}>{children}</section>;
}

/** Коробка под список KeyRow — у неё свой узкий вертикальный отступ. */
export function RowsCard({ children }: { children: ReactNode }) {
  return <div className={styles.rowsCard}>{children}</div>;
}
