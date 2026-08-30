import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './ChipRow.module.css';

export interface Chip<T extends string | number> {
  id: T;
  label: string;
  icon?: IconName;
}

export interface ChipRowProps<T extends string | number> {
  items: readonly Chip<T>[];
  value: T;
  onChange: (id: T) => void;
  /**
   * Чем красится выбранный чип. `neutral` — навигация (правила, документы),
   * цвет сегмента — фильтр внутри топа.
   */
  tone?: 'neutral' | 'paid' | 'free';
}

/**
 * Горизонтальная лента чипов из дизайн-кита: разделы правил, страницы
 * документов, фильтр категорий (Shell.jsx, Screens.jsx). В ките она трижды
 * написана заново — здесь один компонент.
 */
export function ChipRow<T extends string | number>({
  items,
  value,
  onChange,
  tone = 'neutral',
}: ChipRowProps<T>) {
  return (
    <div className={styles.row}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.chip}
          data-tone={tone}
          data-active={item.id === value}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <Icon name={item.icon} size={13} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
