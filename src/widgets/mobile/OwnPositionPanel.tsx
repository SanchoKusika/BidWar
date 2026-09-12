import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { SkeletonBlock, SkeletonText } from '@/shared/ui/Skeleton';
import type { ShowcaseType } from '@/entities/project';
import { strings } from '@/shared/i18n/strings';
import styles from './OwnPositionPanel.module.css';

const t = strings.own;

export interface OwnPositionPanelProps {
  segment: ShowcaseType;
  /** null — позиция ещё не посчиталась (сбой запроса), рендерится прочерком. */
  rank?: number | null;
  /** null/undefined — своей записи ещё нет, панель становится точкой входа. */
  value?: string | null;
  unit?: string;
  hint?: string | null;
  entryHint?: string;
  actionLabel: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onAdd?: () => void;
  addDisabled?: boolean;
  /**
   * The own entry is not known yet. Drawn as the panel with an entry — the
   * state people who come back every day actually see — with placeholders for
   * the numbers, the hint and the button.
   */
  loading?: boolean;
}

/**
 * «Твоя позиция» (07 Экраны.md). Без своей записи та же панель вербует —
 * один большой номер (или прочерк), одно действие.
 */
export function OwnPositionPanel({
  segment,
  rank,
  value,
  unit,
  hint,
  entryHint,
  actionLabel,
  onAction,
  actionDisabled,
  onAdd,
  addDisabled,
  loading = false,
}: OwnPositionPanelProps) {
  if (loading) {
    return (
      <section aria-busy="true" data-segment={segment} className={styles.panel}>
        <div className={styles.row}>
          <div className={styles.headBlock}>
            <span className={styles.label}>{t.position}</span>
            <span className={styles.rank}>
              <SkeletonText tone="inverse">#00</SkeletonText>
            </span>
          </div>
          <div className={styles.valueBlock}>
            <span className={styles.label}>{segment === 'free' ? t.votes : t.bid}</span>
            <span className={styles.value}>
              <SkeletonText tone="inverse">000 000</SkeletonText>
            </span>
          </div>
        </div>
        <span className={styles.hint}>
          <SkeletonText tone="inverse" block width="80%" />
        </span>
        <SkeletonBlock tone="inverse" height={52} radius="var(--radius-control)" />
      </section>
    );
  }

  // "Есть запись" решается по value, не по rank: rank считается отдельным
  // запросом и может не прийти при временном сбое сети, пока сам проект
  // уже найден — в этом случае показывать "нет записи" неверно (код-ревью
  // PR #10), верное состояние — показать панель с прочерком вместо номера.
  const hasEntry = value !== undefined && value !== null;

  if (!hasEntry) {
    return (
      <section data-segment={segment} className={styles.panel}>
        <span className={styles.headBlock}>
          <span className={styles.label}>{t.position}</span>
          <span className={styles.dash}>—</span>
          <span className={styles.sub}>{segment === 'free' ? t.noEntryFree : t.noEntryPaid}</span>
        </span>
        {entryHint && <span className={styles.entryHint}>{entryHint}</span>}
        <Button
          variant={segment}
          size="lg"
          block
          icon="plus"
          onClick={onAdd}
          disabled={addDisabled}
        >
          {t.addMine}
        </Button>
      </section>
    );
  }

  return (
    <section data-segment={segment} className={styles.panel}>
      <div className={styles.row}>
        <div className={styles.headBlock}>
          <span className={styles.label}>{t.position}</span>
          <span className={styles.rank}>{rank != null ? `#${rank}` : '—'}</span>
        </div>
        <div className={styles.valueBlock}>
          <span className={styles.label}>{segment === 'free' ? t.votes : t.bid}</span>
          <span className={styles.value}>
            {value}
            {unit && <span className={styles.unit}>{unit}</span>}
          </span>
        </div>
      </div>

      {hint && <span className={styles.hint}>{hint}</span>}

      <Button
        variant={segment}
        size="lg"
        block
        icon={segment === 'free' ? 'vote' : 'chevrons-up'}
        onClick={onAction}
        disabled={actionDisabled}
      >
        {actionLabel}
      </Button>

      {onAdd && (
        <button type="button" onClick={onAdd} disabled={addDisabled} className={styles.addLink}>
          <Icon name="plus" size={15} />
          {t.addMore}
        </button>
      )}
    </section>
  );
}
