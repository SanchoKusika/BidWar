import { useState } from 'react';
import { AmountInput } from '@/shared/ui/AmountInput';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import { CATEGORY_ICON, detectCategoryIdByUrl, type CategoryStat } from '@/entities/category';
import { normalizeUrlInput, tryParseUrl } from '@/shared/lib/url';
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
  /**
   * Минимальный шаг платного входа (app_config.paid_limits) — только для
   * предпросмотра поля ставки, окончательно считает сервер. Проп не передан
   * ⇒ платный вход на этой странице ещё не подключён (так вызывает Free-
   * страница, у которой платежей нет) — сегмент Paid остаётся на месте, но
   * выбрать его нельзя.
   */
  minPaidAmount?: number;
  /**
   * Топ, с которого открыли шторку — им и должен предзаполняться segment.
   * Без него сегмент по умолчанию решался только по занятости Free-слота
   * (taken.free), а на Paid Top этот слот почти всегда свободен — шторка
   * открывалась на Free, и поле ставки было не видно, пока не переключить
   * карточку руками (код-ревью раунд 1).
   */
  preferredSegment?: ShowcaseType;
  onSubmit: (params: {
    url: string;
    categoryId: number;
    segment: ShowcaseType;
    /** Открывающая ставка платного входа — значимо только при segment === 'paid'. */
    bid: number;
  }) => Promise<void>;
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
 * Paid Top виден всегда; выбираем ли его — зависит от minPaidAmount: платёжный
 * слой пришёл в Срезе 1.5, но подключён пока только на самой странице Paid —
 * Free-страница по-прежнему не передаёт minPaidAmount, и там карточка на
 * месте, но задизейблена (см. paidSoon).
 */
export function AddProjectSheet({
  open,
  onClose,
  categories,
  taken = {},
  minPaidAmount,
  preferredSegment,
  onSubmit,
}: AddProjectSheetProps) {
  const [url, setUrl] = useState('');
  const [segment, setSegment] = useState<ShowcaseType>('free');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  /**
   * Пока false — категория подставляется автоматически по ссылке (см.
   * handleUrlChange). Тап по плитке руками — необратимо на время сессии
   * шторки: дальнейшие правки ссылки больше не перебивают выбор человека.
   */
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [bid, setBid] = useState(minPaidAmount ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Кит сбрасывает поля на каждом открытии. Сравнение с прошлым open прямо в
  // рендере, без эффекта (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUrl('');
      setSegment(preferredSegment ?? (taken.free ? 'paid' : 'free'));
      setCategoryId(null);
      setCategoryTouched(false);
      setBid(minPaidAmount ?? 0);
      setError(null);
    }
  }

  /**
   * Автоподсказка категории по домену (t.me/instagram.com/…) — только пока
   * человек сам не тронул плитки. Ошибиться не страшно: неверную категорию
   * видно сразу и меняется одним тапом (entities/category/detect.ts).
   */
  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (categoryTouched) return;
    const parsed = tryParseUrl(value);
    if (!parsed) return;
    const guess = detectCategoryIdByUrl(parsed, categories);
    if (guess !== null) setCategoryId(guess);
  };

  // Поле показывает нормальный вид ссылки уже до сабмита — окончательно её
  // всё равно нормализует и проверяет сервер (см. _shared/url.ts).
  const handleUrlBlur = () => {
    if (url.trim()) setUrl(normalizeUrlInput(url));
  };

  const paid = segment === 'paid';
  const paidOpen = minPaidAmount !== undefined;
  const blockedSeg = Boolean(taken[segment]);
  const bidTooLow = paid && paidOpen && bid < minPaidAmount;
  const canSubmit =
    url.trim().length >= 4 && categoryId !== null && !blockedSeg && !submitting && !bidTooLow;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || categoryId === null) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ url: url.trim(), categoryId, segment, bid });
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
          onChange={(e) => handleUrlChange(e.target.value)}
          onBlur={handleUrlBlur}
          className={styles.input}
          disabled={submitting}
        />
      </SheetField>

      <SheetField label={t.destinationLabel}>
        <div className={styles.destinations}>
          {destinations.map((d) => {
            const used = Boolean(taken[d.id]);
            // Без minPaidAmount платить не с чем считать — карточка на месте,
            // но выбрать нельзя (см. паспорт пропа выше).
            const locked = d.id === 'paid' && !paidOpen;
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

      {paid && paidOpen && (
        <AmountInput
          segment="paid"
          value={bid}
          onChange={setBid}
          currency="UZS"
          step={minPaidAmount}
          min={minPaidAmount}
          presets={[minPaidAmount, minPaidAmount * 2, minPaidAmount * 10]}
          label={t.openingBidLabel}
          error={bidTooLow ? t.openingBidError(String(minPaidAmount)) : undefined}
          disabled={submitting}
        />
      )}

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
              onClick={() => {
                setCategoryId(cat.categoryId);
                setCategoryTouched(true);
              }}
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
