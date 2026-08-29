import { useState } from 'react';
import { AmountInput } from '@/shared/ui/AmountInput';
import { Button } from '@/shared/ui/Button';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import { formatVotes } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import type { ProjectListItem } from '@/entities/project';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetRows } from './SheetParts';

const t = strings.vote;

export interface VoteSheetProps {
  open: boolean;
  project: ProjectListItem | null;
  rank: number | null;
  /** Баланс голосов аккаунта — потолок для суммы. */
  balance: number;
  preset?: number | null;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

/**
 * Перенос VoteSheet из дизайн-кита (design/ui_kits/mini_app/Sheets.jsx).
 * Бесплатная экономика: в этой шторке нет ни одной денежной сущности —
 * ни суммы, ни валюты, ни перехода на оплату.
 */
export function VoteSheet({
  open,
  project,
  rank,
  balance,
  preset,
  onClose,
  onConfirm,
}: VoteSheetProps) {
  const [amount, setAmount] = useState(preset ?? 10);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setAmount(preset ?? 10);
  }

  if (!project) return null;

  const votes = (v: number) => formatVotes(v, { compact: false });
  const over = amount > balance;

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        media={
          <OgPreview
            src={project.ogImageUrl ?? undefined}
            name={project.name}
            size={44}
            segment="free"
          />
        }
        title={t.title}
        subtitle={rank !== null ? t.subtitle(project.name, rank) : project.name}
      />

      <AmountInput
        segment="free"
        value={amount}
        onChange={setAmount}
        step={1}
        unit={t.unit}
        min={1}
        max={balance}
        balance={balance}
        balanceLabel={t.balanceLabel}
        presets={[5, 25, 100]}
        label={t.amountLabel}
        error={over ? t.amountError : undefined}
      />

      <SheetRows>
        <KeyRow label={t.votesAfter} value={votes(project.votes + amount)} strong tone="free" />
        <KeyRow label={t.youKeep} value={t.keepValue(votes(Math.max(0, balance - amount)))} />
      </SheetRows>

      <SheetActions onSecondary={onClose}>
        <Button
          variant="free"
          size="lg"
          icon="vote"
          disabled={over}
          onClick={() => onConfirm(amount)}
        >
          {t.submit(votes(amount))}
        </Button>
      </SheetActions>
    </Sheet>
  );
}
