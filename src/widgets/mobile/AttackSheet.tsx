import { useState } from 'react';
import { AmountInput } from '@/shared/ui/AmountInput';
import { Button } from '@/shared/ui/Button';
import { KeyRow } from '@/shared/ui/KeyRow';
import { CURRENCY_SUFFIX, formatMoney, type DisplayCurrency } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import type { PaidLimits } from '@/shared/api';
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
   * Начальная ставка цели: ниже её половины ставку не опустить. В
   * ProjectListItem её пока нет — приедет вместе с Attack (Срез 1.6),
   * до тех пор считаем от текущей.
   */
  targetInitial?: number | null;
  /** Своя ставка в платном топе — на неё зачисляется часть суммы. */
  myAmount: number;
  /** Сколько раз по этой цели уже били за сутки, и сколько всего. */
  priorAttacks: number;
  attacksToday: number;
  limits: PaidLimits;
  currency?: DisplayCurrency;
  onClose: () => void;
  onConfirm: (landed: number, credited: number) => void;
}

/**
 * Перенос AttackSheet из дизайн-кита (design/ui_kits/mini_app/Sheets.jsx):
 * два шага — сумма, затем подтверждение с обеими итоговыми ставками.
 *
 * Все коэффициенты приходят из app_config через `limits`, а не лежат
 * константами в клиенте: иначе предпросмотр разъедется с расчётом сервера.
 * Здесь именно предпросмотр — окончательную сумму считает edge-функция.
 */
export function AttackSheet({
  open,
  target,
  rank,
  targetInitial,
  myAmount,
  priorAttacks,
  attacksToday,
  limits,
  currency = 'UZS',
  onClose,
  onConfirm,
}: AttackSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState(limits.minAttackAmount * 25);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(1);
      setAmount(limits.minAttackAmount * 25);
    }
  }

  if (!target) return null;

  const unit = CURRENCY_SUFFIX[currency];
  const money = (v: number) => formatMoney(v, { currency, compact: false });

  const floor = Math.max(
    limits.minPaidAmount,
    Math.round((targetInitial ?? target.paidAmount) * limits.attackFloorOfInitial),
  );
  const room = Math.max(0, target.paidAmount - floor);
  /* Урезаем до того, что реально долетит: за упор в пол платить не надо. */
  const landed = Math.min(amount, room);
  const trimmed = landed < amount;
  const coefficient = Math.max(
    limits.attackHaircutFloor,
    1 - limits.attackHaircutStep * priorAttacks,
  );
  const credited = Math.round(landed * coefficient);
  const pct = Math.round(coefficient * 100);

  const theirAfter = target.paidAmount - landed;
  const myAfter = myAmount + credited;
  const gapBefore = Math.abs(target.paidAmount - myAmount);
  const gapAfter = theirAfter - myAfter;

  const targetSpent = priorAttacks >= limits.maxAttacksPerTargetPerDay;
  const daySpent = attacksToday >= limits.maxAttacksTotalPerDay;
  const blocked = landed < limits.minAttackAmount || targetSpent || daySpent;
  const error = targetSpent
    ? t.targetLimitError(limits.maxAttacksPerTargetPerDay)
    : daySpent
      ? t.dayLimitError(limits.maxAttacksTotalPerDay)
      : landed < limits.minAttackAmount
        ? t.amountError(`${money(limits.minAttackAmount)} ${unit}`)
        : undefined;

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        icon="swords"
        tone="attack"
        singleLine
        title={step === 1 ? t.title : t.titleConfirm}
        subtitle={rank !== null ? t.subtitle(target.name, rank) : target.name}
      />

      <div className={styles.steps}>
        <span className={styles.stepBar} data-on="true" />
        <span className={styles.stepBar} data-on={step === 2} />
        <span className={styles.stepLabel}>{step === 1 ? t.stepAmount : t.stepConfirm}</span>
      </div>

      {step === 1 ? (
        <>
          <AmountInput
            segment="attack"
            value={amount}
            onChange={setAmount}
            currency={currency}
            step={limits.minAttackAmount * 5}
            min={limits.minAttackAmount}
            max={Math.max(limits.minAttackAmount, room)}
            presets={[
              limits.minAttackAmount * 10,
              limits.minAttackAmount * 25,
              limits.minAttackAmount * 50,
            ]}
            label={t.amountLabel}
            error={error}
          />

          <div className={styles.effects}>
            <span className={styles.effectsLabel}>{t.effectsLabel}</span>
            <KeyRow label={t.theirBid} value={`− ${money(landed)}`} tone="attack" />
            <KeyRow
              label={t.yourBid}
              value={`+ ${money(credited)}${coefficient < 1 ? ` (${pct}%)` : ''}`}
              tone="paid"
            />
            <span className={styles.effectsNote}>
              {coefficient < 1 ? t.haircutNote(pct) : t.plainNote}
            </span>
          </div>

          <SheetFootnote tone="muted">
            {t.quota(
              limits.maxAttacksPerTargetPerDay - priorAttacks,
              limits.maxAttacksPerTargetPerDay,
              limits.maxAttacksTotalPerDay - attacksToday,
              limits.maxAttacksTotalPerDay,
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
              value={`${money(target.paidAmount)} → ${money(theirAfter)}`}
              tone="attack"
            />
            <KeyRow
              label={t.yourBid}
              value={`${money(myAmount)} → ${money(myAfter)}`}
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
              {t.trimmedNote(money(landed), money(floor))}
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
