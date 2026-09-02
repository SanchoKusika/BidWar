import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import { Sheet } from './Sheet';
import styles from './ResultSheet.module.css';

export interface ActionResult {
  /** `vote` красится в зелёный: в бесплатной экономике денег не было. */
  kind: 'raise' | 'attack' | 'vote';
  title: string;
  /**
   * null — свежая позиция ещё не подтверждена перечитыванием витрины после
   * действия. Показывать старое (дораисовое) или угаданное число нельзя —
   * это конкретная неправда тому, кто только что заплатил (код-ревью
   * раунд 1) — прочерк честнее и того же начертания, что и в OwnPositionPanel.
   *
   * Поля нет вовсе ⇒ у действия своей позиции не появляется: так у доната в
   * чужую ставку, где меняется ранг ЧУЖОГО проекта, а не платившего.
   */
  rank?: number | null;
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
        {result.rank !== undefined && (
          <span className={styles.rank}>{result.rank !== null ? `#${result.rank}` : '—'}</span>
        )}
        <span className={styles.note}>{result.note}</span>
      </div>

      <Button variant="primary" size="lg" block onClick={onClose}>
        {strings.common.done}
      </Button>
    </Sheet>
  );
}
