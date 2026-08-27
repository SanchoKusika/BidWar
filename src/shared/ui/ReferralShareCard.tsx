import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { group } from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import styles from './ReferralShareCard.module.css';

export interface ReferralShareCardProps {
  /** Реферальная ссылка. Кода для ручного ввода в продукте нет. */
  link: string;
  invited?: number;
  earned?: number;
  rewardPerInvite?: number;
  onCopy?: () => void;
  onShare?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function ReferralShareCard({
  link,
  invited = 0,
  earned = 0,
  rewardPerInvite = 50,
  onCopy,
  onShare,
  className,
  style,
}: ReferralShareCardProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
    onCopy?.();
  };

  return (
    <section className={cx(styles.card, className)} style={style}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.kicker}>Приглашай и получай голоса</span>
          <span className={styles.reward}>+{group(rewardPerInvite)} голосов за друга</span>
        </div>
        <span className={styles.gift}>
          <Icon name="gift" size={20} />
        </span>
      </div>

      <div className={styles.metrics}>
        <Metric label="Приглашено" value={group(invited)} />
        <span className={styles.divider} />
        <Metric label="Голосов получено" value={group(earned)} accent />
      </div>

      <div className={styles.actions}>
        <Button variant="free" size="lg" icon="share-2" className={styles.share} onClick={onShare}>
          Поделиться в Telegram
        </Button>

        <button
          type="button"
          data-copied={copied}
          className={styles.copy}
          aria-label="Скопировать ссылку"
          onClick={copy}
        >
          <Icon name={copied ? 'check' : 'link'} size={20} />
          <span className={styles.copyLabels}>
            <span className={styles.copyIdle}>Скопировать</span>
            <span className={styles.copyDone}>Скопировано</span>
          </span>
        </button>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={styles.metric} data-accent={accent}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}
