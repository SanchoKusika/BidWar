import { useState } from 'react';
import { AmountInput } from '@/shared/ui/AmountInput';
import { Button } from '@/shared/ui/Button';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import {
  CURRENCY_SUFFIX,
  formatEditable,
  formatMoney,
  type DisplayCurrency,
} from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import type { ProjectListItem } from '@/entities/project';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetFootnote, SheetRows } from './SheetParts';

const t = strings.raise;

export interface RaiseSheetProps {
  open: boolean;
  /** Строка платного топа, чью ставку поднимают: своя или чужая. */
  project: ProjectListItem | null;
  /**
   * `own` — своя ставка, `boost` — чужая (01 Механики, «Raise чужого
   * проекта»). Отличаются подписи: на чужой карточке «твоя ставка после»
   * была бы прямой неправдой — своя не меняется вовсе.
   */
  mode?: 'own' | 'boost';
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
  mode = 'own',
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
  const boost = mode === 'boost';

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        media={<OgPreview src={project.ogImageUrl ?? undefined} name={project.name} size={44} />}
        title={boost ? t.boostTitle : t.title}
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
        // Минимум печатается тем же форматом, что и само поле: `formatMoney`
        // округляет для читаемости, и на долларах «4.1» рядом с «4.13» в поле
        // выглядело бы как два разных минимума.
        error={low ? t.amountError(`${formatEditable(minAmount, currency)} ${unit}`) : undefined}
      />

      <SheetRows>
        <KeyRow label={boost ? t.boostBidNow : t.bidNow} value={money(project.paidAmount)} />
        <KeyRow
          label={boost ? t.boostBidAfter : t.bidAfter}
          value={money(project.paidAmount + amount)}
          strong
          tone="paid"
        />
        {rank !== null && (
          <KeyRow label={t.projectedPosition} value={`#${Math.max(1, rank - 1)}`} />
        )}
      </SheetRows>

      <SheetFootnote tone="muted">{boost ? t.boostNote : t.note}</SheetFootnote>

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
