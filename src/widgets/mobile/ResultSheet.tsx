import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import { Sheet } from './Sheet';
import styles from './ResultSheet.module.css';

export interface ActionResult {
  /** `vote` красится в зелёный: в бесплатной экономике денег не было. */
  kind: 'raise' | 'attack' | 'vote';
  title: string;
  rank: number;
  note: string;
}

export interface ResultSheetProps {
  open: boolean;
  result: ActionResult | null;
  onClose: () => void;
}

/**
 * Квитанция после любого действия — платного или голосового
 * (design/ui_kits/mini_app/Sheets.jsx). Одна цифра во весь экран: новая позиция.
 */
export function ResultSheet({ open, result, onClose }: ResultSheetProps) {
  if (!result) return null;

  return (
    <Sheet open={open} onClose={onClose}>
      <div className={styles.body}>
        <span className={styles.mark} data-tone={result.kind === 'vote' ? 'free' : 'paid'}>
          <Icon name="check" size={26} />
        </span>
        <span className={styles.title}>{result.title}</span>
        <span className={styles.rank}>#{result.rank}</span>
        <span className={styles.note}>{result.note}</span>
      </div>

      <Button variant="primary" size="lg" block onClick={onClose}>
        {strings.common.done}
      </Button>
    </Sheet>
  );
}
