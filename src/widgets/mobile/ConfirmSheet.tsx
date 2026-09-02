import { Button } from '@/shared/ui/Button';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetNote } from './SheetParts';
import styles from './ConfirmSheet.module.css';

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  /** Что именно произойдёт — прямым текстом, без «вы уверены?». */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Идёт запрос — кнопка подтверждения показывает загрузку. */
  busy?: boolean;
  /** Отказ сервера: остаёмся в шторке и говорим, что не вышло. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Подтверждение необратимого действия. Шторка, а не `confirm()`: единственный
 * модальный паттерн в системе — нижняя панель (07 Экраны.md), и системный
 * диалог внутри Telegram выглядел бы чужим.
 *
 * Плашка идёт в тоне `attack` — в системе он означает «необратимое», и это
 * ровно тот случай. Кнопка при этом обычная: вариант `attack` несёт не риск, а
 * саму механику атаки (см. паспорт Button), и красить им подтверждение
 * значило бы обещать другое действие.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title={title} />

      <div className={styles.body}>
        <SheetNote tone="attack" icon="triangle-alert">
          {body}
        </SheetNote>
        {error && (
          <SheetNote tone="muted" icon="triangle-alert">
            {error}
          </SheetNote>
        )}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" size="lg" block onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant="primary" size="lg" block loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
