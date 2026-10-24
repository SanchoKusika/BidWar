import { CURRENCY_SUFFIX, DEFAULT_CURRENCY } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import { Icon } from './Icon';
import { SkeletonBlock, SkeletonText } from './Skeleton';
import styles from './ReceiptRow.module.css';

export type ReceiptKind = 'raise' | 'attack' | 'entry';

export interface ReceiptRowProps {
  kind: ReceiptKind;
  /** The project paid for, or the one attacked. */
  subject: string;
  /** Already formatted date and time of the charge. */
  when: string;
  provider?: string;
  /** The charged amount as is, already formatted with its unit. */
  amount: string;
}

const ICON = { raise: 'chevrons-up', entry: 'chevrons-up', attack: 'swords' } as const;

/**
 * One charge in the receipts list. The project shares its line only with the
 * amount, and the date runs under both: packed into one «label — value» row, a
 * long handle pushed the amount onto two lines and «−10 000 ₽» read as «−10»
 * over «000 ₽».
 */
export function ReceiptRow({ kind, subject, when, provider, amount }: ReceiptRowProps) {
  const meta = [strings.profile.receiptKind[kind], when, provider].filter(Boolean).join(' · ');
  return (
    <div className={styles.row} data-kind={kind}>
      <span className={styles.badge} aria-hidden="true">
        <Icon name={ICON[kind]} size={16} />
      </span>
      <span className={styles.subject} title={subject}>
        {subject}
      </span>
      <span className={styles.amount}>{amount}</span>
      <span className={styles.meta}>{meta}</span>
    </div>
  );
}

/** The same row before `my-spending` answers; `width` varies the subject line so the block does not read as a grid. */
export function ReceiptRowSkeleton({ width }: { width: number }) {
  return (
    <div className={styles.row}>
      <SkeletonBlock
        width="var(--receipt-badge)"
        height="var(--receipt-badge)"
        radius="var(--radius-sm)"
      />
      <span className={styles.subject}>
        <SkeletonText width={width} />
      </span>
      <span className={styles.amount}>
        <SkeletonText>−00 000 {CURRENCY_SUFFIX[DEFAULT_CURRENCY]}</SkeletonText>
      </span>
      <span className={styles.meta}>
        <SkeletonText width={176} />
      </span>
    </div>
  );
}
