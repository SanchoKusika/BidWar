import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './HeaderAction.module.css';

export interface HeaderActionProps {
  icon: IconName;
  label: string;
  onClick: () => void;
}

/**
 * Мелкий чип в шапке ленты — вход в правила
 * (design/ui_kits/mini_app/Shell.jsx). В мини-аппе это замена вкладке «Rules»,
 * которая есть на сайте: четыре вкладки внизу заняты, пятую заводить нельзя.
 */
export function HeaderAction({ icon, label, onClick }: HeaderActionProps) {
  return (
    <button type="button" onClick={onClick} title={label} className={styles.action}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
