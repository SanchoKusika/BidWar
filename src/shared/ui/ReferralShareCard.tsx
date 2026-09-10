import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { group } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import { cx } from '@/shared/lib/cx';
import styles from './ReferralShareCard.module.css';

export interface ReferralShareCardProps {
  /** Реферальная ссылка. Кода для ручного ввода в продукте нет. */
  link: string;
  invited?: number;
  earned?: number;
  /**
   * Награда за друга — из `app_config.task_rewards`, не из константы.
   * Дефолта здесь нет намеренно: раньше стояло 50, и карточка обещала число,
   * которого механика не знает (01 Механики называет 3).
   */
  rewardPerInvite: number;
  onCopy?: () => void;
  onShare?: () => void;
  className?: string;
  style?: CSSProperties;
}

const t = strings.referral;

export function ReferralShareCard({
  link,
  invited = 0,
  earned = 0,
  rewardPerInvite,
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
          <span className={styles.kicker}>{t.kicker}</span>
          <span className={styles.reward}>{t.reward(group(rewardPerInvite))}</span>
        </div>
        <span className={styles.gift}>
          <Icon name="gift" size={20} />
        </span>
      </div>

      <div className={styles.metrics}>
        <Metric label={t.invited} value={group(invited)} />
        <span className={styles.divider} />
        <Metric label={t.earned} value={group(earned)} accent />
      </div>

      <div className={styles.actions}>
        {/* Без обработчика кнопку не рисуем: неработающая врёт сильнее
            отсутствующей (CLAUDE.md). Копирование ссылки работает всегда — оно
            целиком внутри карточки. */}
        {onShare && (
          <Button
            variant="free"
            size="lg"
            icon="share-2"
            className={styles.share}
            onClick={onShare}
          >
            {t.share}
          </Button>
        )}

        <button
          type="button"
          data-copied={copied}
          className={styles.copy}
          aria-label={t.copyAria}
          onClick={copy}
        >
          <Icon name={copied ? 'check' : 'link'} size={20} />
          <span className={styles.copyLabels}>
            <span className={styles.copyIdle}>{t.copy}</span>
            <span className={styles.copyDone}>{t.copied}</span>
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
