import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './Settings.module.css';

export interface SettingsGroupProps {
  label?: string;
  footnote?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Одна карточка с волосяными разделителями. Подпись стоит снаружи карточки. */
export function SettingsGroup({ label, footnote, children, className, style }: SettingsGroupProps) {
  return (
    <div className={cx(styles.group, className)} style={style}>
      {label && <span className={styles.groupLabel}>{label}</span>}
      <div className={styles.card}>{children}</div>
      {footnote && <span className={styles.footnote}>{footnote}</span>}
    </div>
  );
}

export interface SettingsRowProps {
  icon?: IconName;
  title: string;
  description?: string;
  /** Switch, Segmented или ничего — тогда это навигационная строка с onPress. */
  control?: ReactNode;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SettingsRow({
  icon,
  title,
  description,
  control,
  value,
  onPress,
  danger = false,
  disabled = false,
  className,
  style,
}: SettingsRowProps) {
  const pressable = Boolean(onPress) && !disabled;
  const isNav = !control && Boolean(onPress);

  return (
    <div
      data-pressable={pressable}
      data-danger={danger}
      data-disabled={disabled}
      className={cx(styles.row, className)}
      style={style}
      onClick={pressable ? onPress : undefined}
    >
      {icon && (
        <span className={styles.icon}>
          <Icon name={icon} size={16} />
        </span>
      )}

      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>

      {control}
      {value !== undefined && <span className={styles.value}>{value}</span>}
      {isNav && <Icon name="chevron-right" size={16} color="var(--text-muted)" />}
    </div>
  );
}
