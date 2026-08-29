import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import { CATEGORY_ICON, type CategoryStat } from '@/entities/category';
import type { ShowcaseType } from '@/entities/project';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetField, SheetFootnote, SheetNote } from './SheetParts';
import styles from './AddProjectSheet.module.css';

const t = strings.addProject;
const common = strings.common;

export interface AddProjectSheetProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryStat[];
  /** Слоты аккаунта: по одному проекту в каждом топе, второй туда же не влезет. */
  taken?: { free?: boolean; paid?: boolean };
  onSubmit: (params: { url: string; categoryId: number; segment: ShowcaseType }) => Promise<void>;
}

/**
 * Перенос AddProjectSheet из дизайн-кита (design/ui_kits/mini_app/Sheets.jsx):
 * шапка «иконка + тайтл + подпись», PROJECT LINK, WHERE IT COMPETES, сноска
 * про два слота и пара Cancel / Submit.
 *
 * Два осознанных отступления от кита:
 *  1. Блок CATEGORY — в ките его нет, но projects.category_id обязателен, так
 *     что категория выбирается третьим блоком теми же карточками.
 *  2. Иконка в шапке красится по выбранному топу, а не жёстко в paid-tint:
 *     в макете, по которому сверялись, она зелёная — то есть под Free Top,
 *     который здесь и стоит по умолчанию.
 *
 * Paid Top виден, но неактивен: вход туда — открывающий Raise-платёж, он
 * появится вместе с платёжным слоем (Срез 1.5).
 */
export function AddProjectSheet({
  open,
  onClose,
  categories,
  taken = {},
  onSubmit,
}: AddProjectSheetProps) {
  const [url, setUrl] = useState('');
  const [segment, setSegment] = useState<ShowcaseType>('free');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Кит сбрасывает поля на каждом открытии. Сравнение с прошлым open прямо в
  // рендере, без эффекта (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUrl('');
      setSegment(taken.free ? 'paid' : 'free');
      setCategoryId(null);
      setError(null);
    }
  }

  const paid = segment === 'paid';
  const blockedSeg = Boolean(taken[segment]);
  const canSubmit = url.trim().length >= 4 && categoryId !== null && !blockedSeg && !submitting;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || categoryId === null) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ url: url.trim(), categoryId, segment });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const destinations = [
    { id: 'free' as const, ...t.free },
    { id: 'paid' as const, ...t.paid },
  ];

  return (
    <Sheet open={open} onClose={handleClose}>
      <SheetHeader icon="link" tone={segment} title={t.title} subtitle={t.subtitle} />

      <SheetField as="label" label={t.linkLabel}>
        <input
          type="url"
          inputMode="url"
          placeholder={t.linkPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={styles.input}
          disabled={submitting}
        />
      </SheetField>

      <SheetField label={t.destinationLabel}>
        <div className={styles.destinations}>
          {destinations.map((d) => {
            const used = Boolean(taken[d.id]);
            // Paid Top ещё не открыт — карточка на месте, но выбрать нельзя.
            const locked = d.id === 'paid';
            return (
              <button
                key={d.id}
                type="button"
                className={styles.destination}
                data-segment={d.id}
                data-active={segment === d.id}
                data-dimmed={used || locked}
                disabled={submitting || locked}
                onClick={() => setSegment(d.id)}
              >
                <span className={styles.destinationLabel}>{d.label}</span>
                <span className={styles.destinationSub}>
                  {used ? t.slotUsed : locked ? t.paidSoon : d.sub}
                </span>
              </button>
            );
          })}
        </div>
      </SheetField>

      <SheetField label={t.categoryLabel}>
        <div className={styles.categories}>
          {categories.map((cat) => (
            <button
              key={cat.categoryId}
              type="button"
              className={styles.category}
              data-segment={segment}
              data-active={categoryId === cat.categoryId}
              disabled={submitting}
              onClick={() => setCategoryId(cat.categoryId)}
            >
              <Icon name={CATEGORY_ICON[cat.slug] ?? 'folder'} size={16} />
              <span className={styles.categoryName}>{cat.title}</span>
            </button>
          ))}
        </div>
      </SheetField>

      {!paid && (
        <SheetNote tone="free" icon="list-checks">
          {t.freeNote}
        </SheetNote>
      )}

      {error && <span className={styles.error}>{error}</span>}

      <SheetFootnote>{t.footnote}</SheetFootnote>

      <SheetActions onSecondary={handleClose} secondaryDisabled={submitting}>
        <Button
          variant={paid ? 'paid' : 'free'}
          size="lg"
          icon={paid ? 'credit-card' : undefined}
          loading={submitting}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {blockedSeg ? t.slotUsed : paid ? common.continueToPayment : t.submitFree}
        </Button>
      </SheetActions>
    </Sheet>
  );
}
