import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { KeyRow, type KeyRowTone } from '@/shared/ui/KeyRow';
import { CURRENCY_SUFFIX, formatMoney, type DisplayCurrency } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import { activePaymentMethods } from '@/shared/content';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetField, SheetFootnote, SheetNote, SheetRows } from './SheetParts';
import styles from './PaySheet.module.css';

const t = strings.pay;

export interface PayLine {
  label: string;
  value: string;
  tone?: KeyRowTone;
}

export interface PayPayload {
  kind: 'raise' | 'attack' | 'project';
  amount: number;
  /** Имя проекта под заголовком: «Raise · Mebel Savdo». */
  subtitle: string;
  /** Имя соперника — только для атаки, в предупреждении. */
  rival?: string;
  lines?: PayLine[];
}

export interface PaySheetProps {
  open: boolean;
  payload: PayPayload | null;
  currency?: DisplayCurrency;
  onClose: () => void;
  onConfirm: (providerId: string) => void;
}

const TITLE: Record<PayPayload['kind'], string> = {
  attack: t.titleAttack,
  project: t.titleProject,
  raise: t.titleRaise,
};

/**
 * Единственное платёжное окно на все платные действия — рейз, атака,
 * открывающий бид (design/ui_kits/mini_app/Sheets.jsx).
 *
 * Баланса у продукта нет: сумма, выбранная на предыдущем экране, списывается
 * здесь один раз, на странице самого провайдера, сразу в ту позицию, которую
 * покупает. Поэтому в шторке нет ни пополнения, ни остатка.
 */
export function PaySheet({ open, payload, currency = 'UZS', onClose, onConfirm }: PaySheetProps) {
  const [providerId, setProviderId] = useState(activePaymentMethods[0].id);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setProviderId(activePaymentMethods[0].id);
  }

  if (!payload) return null;

  const attack = payload.kind === 'attack';
  const tone = attack ? 'attack' : 'paid';
  const provider = activePaymentMethods.find((p) => p.id === providerId) ?? activePaymentMethods[0];
  const amount = formatMoney(payload.amount, { currency, compact: false });

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        icon={attack ? 'swords' : 'credit-card'}
        tone={tone}
        singleLine
        title={TITLE[payload.kind]}
        subtitle={payload.subtitle}
      />

      <div className={styles.total} data-tone={tone}>
        <span className={styles.totalLabel}>{t.youPay}</span>
        <span className={styles.totalValue}>
          <span className={styles.totalAmount}>{amount}</span>
          <span className={styles.totalUnit}>{CURRENCY_SUFFIX[currency]}</span>
        </span>
      </div>

      {payload.lines && payload.lines.length > 0 && (
        <SheetRows>
          {payload.lines.map((line) => (
            <KeyRow key={line.label} label={line.label} value={line.value} tone={line.tone} />
          ))}
        </SheetRows>
      )}

      {attack && (
        <SheetNote tone="attack" icon="triangle-alert">
          {t.attackWarning(payload.rival ?? 'the rival')}
        </SheetNote>
      )}

      <SheetField label={t.methodLabel}>
        <div className={styles.methods}>
          {activePaymentMethods.map((p) => {
            const on = p.id === providerId;
            return (
              <button
                key={p.id}
                type="button"
                className={styles.method}
                data-tone={tone}
                data-active={on}
                onClick={() => setProviderId(p.id)}
              >
                <span className={styles.methodIcon}>
                  <Icon name={p.icon as IconName} size={18} />
                </span>
                <span className={styles.methodText}>
                  <span className={styles.methodName}>{p.name}</span>
                  <span className={styles.methodDesc}>{p.desc}</span>
                </span>
                <span className={styles.methodMeta}>
                  <span className={styles.methodUnit}>{p.unit}</span>
                  {p.fee && <span className={styles.methodFee}>{p.fee}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </SheetField>

      <SheetFootnote tone="muted">{t.chargeNote(provider.name, provider.unit)}</SheetFootnote>

      <SheetActions onSecondary={onClose}>
        <Button
          variant={attack ? 'attack' : 'paid'}
          size="lg"
          icon="credit-card"
          onClick={() => onConfirm(provider.id)}
        >
          {t.submit(amount, provider.name)}
        </Button>
      </SheetActions>

      <SheetFootnote tone="muted">{t.footnote(provider.name)}</SheetFootnote>
    </Sheet>
  );
}
