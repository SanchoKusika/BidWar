import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'outline' | 'paid' | 'free' | 'attack' | 'attack-quiet';

export type ButtonSize = 'sm' | 'md' | 'lg';

/** Размер иконки привязан к размеру кнопки, поэтому живёт в TS, а не в CSS. */
const ICON_SIZE: Record<ButtonSize, number> = { sm: 15, md: 18, lg: 20 };

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  /** Квадратная кнопка без подписи. */
  iconOnly?: boolean;
  /** Во всю ширину — так выглядят основные действия в шторках. */
  block?: boolean;
  pill?: boolean;
  disabled?: boolean;
  /** Спиннер и блокировка. Показывается, пока идёт платёж. */
  loading?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: CSSProperties;
}

/**
 * Единственная кнопка системы. Вариант несёт экономику и риск, а не просто цвет,
 * поэтому attack никогда не используется как обычное подтверждение.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  block = false,
  pill = false,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className,
  style,
}: ButtonProps) {
  const iconSize = ICON_SIZE[size];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={cx(
        styles.button,
        block && styles.block,
        pill && styles.pill,
        iconOnly && styles.iconOnly,
        className,
      )}
      style={style}
    >
      {loading ? (
        <span
          className={styles.spinner}
          style={{ '--spinner-size': `${iconSize}px` } as CSSProperties}
        />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {!iconOnly && children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
