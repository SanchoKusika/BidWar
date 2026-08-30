import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './SheetHeader.module.css';

export type SheetHeaderTone = 'free' | 'paid' | 'attack';

export interface SheetHeaderProps {
  /** Тонированный квадрат 44×44 с иконкой. Взаимоисключим с `media`. */
  icon?: IconName;
  tone?: SheetHeaderTone;
  /** Превью проекта вместо иконки — так открываются Raise и Give votes. */
  media?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /**
   * Подпись в одну строку с многоточием и поле справа: так в ките сделаны
   * Attack и Pay, где в подписи стоит имя чужого проекта произвольной длины.
   */
  singleLine?: boolean;
}

/**
 * Шапка шторки из дизайн-кита (design/ui_kits/mini_app/Sheets.jsx): слева
 * иконка или превью проекта, справа заголовок с подписью. Повторяется во всех
 * пяти шторках кита, поэтому вынесена отдельно.
 */
export function SheetHeader({
  icon,
  tone = 'paid',
  media,
  title,
  subtitle,
  singleLine = false,
}: SheetHeaderProps) {
  return (
    <div className={styles.header} data-single-line={singleLine}>
      {media ??
        (icon && (
          <span className={styles.iconBox} data-tone={tone}>
            <Icon name={icon} size={22} />
          </span>
        ))}
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
    </div>
  );
}
