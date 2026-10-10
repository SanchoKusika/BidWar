import { useEffect, useRef } from 'react';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { haptic } from '@/shared/lib/haptic';
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
  const rowRef = useRef<HTMLDivElement>(null);
  const settled = useRef(false);

  // The chosen chip is brought into the row's view: a link to /rules/attacks
  // opened the rules with «Attacks» chosen and cut off past the right edge.
  // Only the row scrolls, never the page; at once on arrival, smoothly after.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[data-active="true"]');
    if (!row || !chip) return;
    const rowBox = row.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const offset = chipBox.left - rowBox.left - (rowBox.width - chipBox.width) / 2;
    row.scrollBy({ left: offset, behavior: settled.current ? 'smooth' : 'auto' });
    settled.current = true;
  }, [value]);

  return (
    <div className={styles.row} ref={rowRef}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.chip}
          data-tone={tone}
          data-active={item.id === value}
          onClick={() => {
            // Тот же выбор из вариантов, что у сегментов: отклик слабый и
            // только когда чип правда сменился.
            if (item.id !== value) haptic('selection');
            onChange(item.id);
          }}
        >
          {item.icon && <Icon name={item.icon} size={13} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
