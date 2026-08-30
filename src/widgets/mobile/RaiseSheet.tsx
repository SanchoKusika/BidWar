import { useState } from 'react';
import { AmountInput } from '@/shared/ui/AmountInput';
import { Button } from '@/shared/ui/Button';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import { CURRENCY_SUFFIX, formatMoney, type DisplayCurrency } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import type { ProjectListItem } from '@/entities/project';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetFootnote, SheetRows } from './SheetParts';

const t = strings.raise;

export interface RaiseSheetProps {
  open: boolean;
  /** Своя строка в платном топе — та, чью ставку поднимают. */
  project: ProjectListItem | null;
  rank: number | null;
  /** Предзаполненная сумма: приходит из «занять это место». */
  preset?: number | null;
  /** Минимальный шаг ставки из app_config, а не из константы в клиенте. */
  minAmount: number;
  currency?: DisplayCurrency;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

/**
 * Перенос RaiseSheet из дизайн-кита (design/ui_kits/mini_app/Sheets.jsx).
 * Баланса в продукте нет: шторка выбирает сумму и ведёт на оплату, ставка
 * поднимается только после подтверждения провайдера.
 */
export function RaiseSheet({
  open,
  project,
  rank,
  preset,
  minAmount,
  currency = 'UZS',
  onClose,
  onConfirm,
}: RaiseSheetProps) {
  const [amount, setAmount] = useState(preset ?? minAmount);

  // Кит переустанавливает сумму на каждом открытии — сравнением в рендере,
  // без эффекта (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setAmount(preset ?? minAmount);
  }

  if (!project) return null;

  const unit = CURRENCY_SUFFIX[currency];
  const money = (v: number) => formatMoney(v, { currency, compact: false });
  const low = amount < minAmount;

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        media={<OgPreview src={project.ogImageUrl ?? undefined} name={project.name} size={44} />}
        title={t.title}
        subtitle={rank !== null ? t.subtitle(project.name, rank) : project.name}
      />

      <AmountInput
        segment="paid"
        value={amount}
        onChange={setAmount}
        currency={currency}
        step={minAmount}
        min={minAmount}
        presets={[minAmount, minAmount * 2, minAmount * 10]}
        label={t.amountLabel}
        error={low ? t.amountError(`${money(minAmount)} ${unit}`) : undefined}
      />

      <SheetRows>
        <KeyRow label={t.bidNow} value={money(project.paidAmount)} />
        <KeyRow label={t.bidAfter} value={money(project.paidAmount + amount)} strong tone="paid" />
        {rank !== null && (
          <KeyRow label={t.projectedPosition} value={`#${Math.max(1, rank - 1)}`} />
        )}
      </SheetRows>

      <SheetFootnote tone="muted">{t.note}</SheetFootnote>

      <SheetActions onSecondary={onClose}>
        <Button
          variant="paid"
          size="lg"
          icon="credit-card"
          disabled={low}
          onClick={() => onConfirm(amount)}
        >
          {strings.common.continueToPayment}
        </Button>
      </SheetActions>
    </Sheet>
  );
}
