import { useState } from 'react';
import { AmountInput } from '@/shared/ui/AmountInput';
import { Button } from '@/shared/ui/Button';
import { KeyRow } from '@/shared/ui/KeyRow';
import { CURRENCY_SUFFIX, formatMoney, type DisplayCurrency } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import { creditedFromBp, type AttackQuote } from '@/features/attack';
import type { ProjectListItem } from '@/entities/project';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetFootnote, SheetNote, SheetRows } from './SheetParts';
import styles from './AttackSheet.module.css';

const t = strings.attack;

export interface AttackSheetProps {
  open: boolean;
  /** Чужая строка, по которой бьют. */
  target: ProjectListItem | null;
  rank: number | null;
  /**
   * Расчёт с сервера (`attack-quote`): пол цели, остаток до него, коэффициент
   * зачисления и остаток скользящих лимитов. null — ещё не приехал.
   */
  quote: AttackQuote | null;
  quoteError: string | null;
  currency?: DisplayCurrency;
  onClose: () => void;
  onConfirm: (landed: number, credited: number) => void;
}

/**
 * Перенос AttackSheet из дизайн-кита (design/ui_kits/mini_app/Sheets.jsx):
 * два шага — сумма, затем подтверждение с обеими итоговыми ставками.
 *
 * Ни одно правило здесь не считается: пол, коэффициент и лимиты приходят
 * готовыми из `attack-quote`, шторка только показывает, что из них следует
 * для выбранной суммы. Свой набор коэффициентов в клиенте разъехался бы с
 * тем, по которому спишут деньги, — а окончательный расчёт всё равно делает
 * `apply_payment` под блокировкой строк.
 */
export function AttackSheet({
  open,
  target,
  rank,
  quote,
  quoteError,
  currency = 'UZS',
  onClose,
  onConfirm,
}: AttackSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  /** null — человек ещё не трогал ползунок, показываем предложенную сумму. */
  const [amount, setAmount] = useState<number | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(1);
      setAmount(null);
    }
  }

  if (!target) return null;

  const unit = CURRENCY_SUFFIX[currency];
  const money = (v: number) => formatMoney(v, { currency, compact: false });

  const header = (
    <SheetHeader
      icon="swords"
      tone="attack"
      singleLine
      title={step === 1 ? t.title : t.titleConfirm}
      subtitle={rank !== null ? t.subtitle(target.name, rank) : target.name}
    />
  );

  // Расчёт не приехал — показывать нечего и посчитать нечем. Пустая шторка с
  // причиной честнее, чем цифры на догадках.
  if (!quote) {
    return (
      <Sheet open={open} onClose={onClose}>
        {header}
        <SheetNote tone="muted" icon={quoteError ? 'triangle-alert' : 'info'}>
          {quoteError ?? strings.common.loading}
        </SheetNote>
        <SheetActions onSecondary={onClose}>
          <Button variant="attack-quiet" size="lg" disabled>
            {t.review}
          </Button>
        </SheetActions>
      </Sheet>
    );
  }

  const suggested = Math.min(
    Math.max(quote.minAttackAmount, quote.minAttackAmount * 25),
    Math.max(quote.minAttackAmount, quote.room),
  );
  const value = amount ?? suggested;

  /* Урезаем до того, что реально долетит: за упор в пол платить не надо. */
  const landed = Math.min(value, quote.room);
  const trimmed = landed < value;
  const credited = creditedFromBp(landed, quote.coefficientBp);
  const pct = Math.round(quote.coefficientBp / 100);

  const theirAfter = quote.targetAmount - landed;
  const myAfter = quote.ownAmount + credited;
  const gapBefore = Math.abs(quote.targetAmount - quote.ownAmount);
  const gapAfter = theirAfter - myAfter;

  const noRoom = quote.room <= 0;
  const targetSpent = quote.attacksLeftOnTarget <= 0;
  const daySpent = quote.attacksLeftToday <= 0;
  const blocked = noRoom || targetSpent || daySpent || landed < quote.minAttackAmount;
  const error = noRoom
    ? t.floorReached
    : targetSpent
      ? t.targetLimitError(quote.maxAttacksOnTarget)
      : daySpent
        ? t.dayLimitError(quote.maxAttacksToday)
        : landed < quote.minAttackAmount
          ? t.amountError(`${money(quote.minAttackAmount)} ${unit}`)
          : undefined;

  return (
    <Sheet open={open} onClose={onClose}>
      {header}

      <div className={styles.steps}>
        <span className={styles.stepBar} data-on="true" />
        <span className={styles.stepBar} data-on={step === 2} />
        <span className={styles.stepLabel}>{step === 1 ? t.stepAmount : t.stepConfirm}</span>
      </div>

      {step === 1 ? (
        <>
          <AmountInput
            segment="attack"
            value={value}
            onChange={setAmount}
            currency={currency}
            step={quote.minAttackAmount * 5}
            min={quote.minAttackAmount}
            max={Math.max(quote.minAttackAmount, quote.room)}
            presets={[
              quote.minAttackAmount * 10,
              quote.minAttackAmount * 25,
              quote.minAttackAmount * 50,
            ]}
            label={t.amountLabel}
            error={error}
          />

          <div className={styles.effects}>
            <span className={styles.effectsLabel}>{t.effectsLabel}</span>
            <KeyRow label={t.theirBid} value={`− ${money(landed)}`} tone="attack" />
            <KeyRow
              label={t.yourBid}
              value={`+ ${money(credited)}${quote.coefficientBp < 10000 ? ` (${pct}%)` : ''}`}
              tone="paid"
            />
            <span className={styles.effectsNote}>
              {quote.coefficientBp < 10000
                ? t.haircutNote(pct, quote.haircutResetHours)
                : t.plainNote}
            </span>
          </div>

          <SheetFootnote tone="muted">
            {t.quota(
              quote.attacksLeftOnTarget,
              quote.maxAttacksOnTarget,
              quote.attacksLeftToday,
              quote.maxAttacksToday,
            )}
          </SheetFootnote>

          <SheetActions onSecondary={onClose}>
            <Button variant="attack-quiet" size="lg" disabled={blocked} onClick={() => setStep(2)}>
              {t.review}
            </Button>
          </SheetActions>
        </>
      ) : (
        <>
          <SheetRows>
            <KeyRow
              label={t.youPayPlatform}
              value={`${money(landed)} ${unit}`}
              strong
              tone="attack"
            />
            <KeyRow
              label={t.rivalBid(target.name)}
              value={`${money(quote.targetAmount)} → ${money(theirAfter)}`}
              tone="attack"
            />
            <KeyRow
              label={t.yourBid}
              value={`${money(quote.ownAmount)} → ${money(myAfter)}`}
              tone="paid"
            />
            <KeyRow label={t.creditedToYou} value={t.creditedShare(pct)} />
            <KeyRow
              label={t.gap}
              value={`${money(gapBefore)} → ${gapAfter <= 0 ? t.gapPassed : money(gapAfter)}`}
              strong
            />
          </SheetRows>

          {trimmed && (
            <SheetNote tone="muted" icon="info">
              {t.trimmedNote(money(landed), money(quote.floor))}
            </SheetNote>
          )}

          <SheetNote tone="attack" icon="triangle-alert">
            {t.warning(target.name)}
          </SheetNote>

          <SheetActions onSecondary={() => setStep(1)} secondaryLabel={strings.common.back}>
            <Button
              variant="attack"
              size="lg"
              icon="credit-card"
              onClick={() => onConfirm(landed, credited)}
            >
              {strings.common.continueToPayment}
            </Button>
          </SheetActions>
        </>
      )}
    </Sheet>
  );
}
