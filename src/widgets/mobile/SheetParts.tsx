import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import { strings } from '@/shared/i18n/strings';
import styles from './SheetParts.module.css';

/* Куски, повторяющиеся во всех шторках дизайн-кита
   (design/ui_kits/mini_app/Sheets.jsx). Вынесены, чтобы шесть шторок не
   разъехались по отступам и тонам. */

export interface SheetFieldProps {
  /** Капслок-подпись над контролом. */
  label: ReactNode;
  children: ReactNode;
  /** `label` оборачивает контрол — так подпись кликабельна вместе с полем. */
  as?: 'div' | 'label';
  className?: string;
}

export function SheetField({ label, children, as = 'div', className }: SheetFieldProps) {
  const Tag = as;
  return (
    <Tag className={cx(styles.field, className)}>
      <span className={styles.label}>{label}</span>
      {children}
    </Tag>
  );
}

/** Тон плашки несёт экономику: зелёная — бесплатное, красная — необратимое. */
export type SheetNoteTone = 'free' | 'paid' | 'attack' | 'muted';

export interface SheetNoteProps {
  tone: SheetNoteTone;
  icon: IconName;
  children: ReactNode;
}

export function SheetNote({ tone, icon, children }: SheetNoteProps) {
  return (
    <div className={styles.note} data-tone={tone}>
      <Icon name={icon} size={16} className={styles.noteIcon} />
      <span>{children}</span>
    </div>
  );
}

export interface SheetFootnoteProps {
  children: ReactNode;
  /** `muted` — служебная приписка под кнопками, `secondary` — часть правил. */
  tone?: 'secondary' | 'muted';
}

export function SheetFootnote({ children, tone = 'secondary' }: SheetFootnoteProps) {
  return (
    <p className={styles.footnote} data-tone={tone}>
      {children}
    </p>
  );
}

/** Блок строк «подпись — значение» без внешних отступов. */
export function SheetRows({ children }: { children: ReactNode }) {
  return <div className={styles.rows}>{children}</div>;
}

export interface SheetActionsProps {
  /** Левая узкая кнопка: Cancel или Back. */
  onSecondary: () => void;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
  /** Правая кнопка во всю оставшуюся ширину. */
  children: ReactNode;
}

export function SheetActions({
  onSecondary,
  secondaryLabel = strings.common.cancel,
  secondaryDisabled = false,
  children,
}: SheetActionsProps) {
  return (
    <div className={styles.actions}>
      <Button
        variant="secondary"
        size="lg"
        className={styles.secondary}
        disabled={secondaryDisabled}
        onClick={onSecondary}
      >
        {secondaryLabel}
      </Button>
      {children}
    </div>
  );
}
