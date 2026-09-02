import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { RankBadge } from './RankBadge';
import { StatBlock } from './StatBlock';
import { OgPreview, type Segment } from './OgPreview';
import { Button } from './Button';
import { Icon } from './Icon';
import { formatCount, type DisplayCurrency } from '@/shared/lib/format';
import { cx } from '@/shared/lib/cx';
import { displayUrl } from '@/shared/lib/url';
import styles from './ProjectCard.module.css';

/** Действие внутри карточки не должно открывать саму карточку. */
const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

export interface ProjectCardProps {
  segment?: Segment;
  rank?: number;
  /**
   * Изменение позиции. Источника пока нет — истории рангов в схеме не
   * существует, — поэтому не передаётся ниоткуда, и строка под бейджем не
   * рисуется (см. паспорт RankBadge.delta).
   */
  rankDelta?: number;
  name: string;
  /** Автоописание с сайта. Если его нет, показывается ссылка. */
  description?: string;
  ogImage?: string;
  url?: string;
  value: number;
  valueDelta?: number;
  currency?: DisplayCurrency;
  /** «12.5 mln» вместо «12 500 000» — настройка профиля (shared/settings). */
  compactAmounts?: boolean;
  /** Публичный счётчик переходов. На позицию не влияет. */
  clicks?: number;
  /** Сколько лидер держит первое место. Только для rank === 1. */
  heldFor?: string;
  /** Цена этой позиции, уже отформатированная вызывающим кодом. */
  spotPrice?: string;
  spotUnit?: string;
  /** Категория, в которой проект лидирует. */
  catLeader?: string;
  isOwn?: boolean;
  verified?: boolean;
  /**
   * Raise, Attack и Give votes видны, но не нажимаются: экономика подключается
   * в Срезах 1.5–1.7. «Подробнее» это не касается — переход работает всегда.
   */
  actionsDisabled?: boolean;
  onPress?: () => void;
  onRaise?: () => void;
  onAttack?: () => void;
  onVote?: () => void;
  onTakeSpot?: () => void;
  onDetails?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function ProjectCard({
  segment = 'paid',
  rank,
  rankDelta,
  name,
  description,
  ogImage,
  url,
  value,
  valueDelta,
  currency,
  compactAmounts,
  clicks,
  heldFor,
  spotPrice,
  spotUnit,
  catLeader,
  isOwn = false,
  actionsDisabled = false,
  verified = false,
  onPress,
  onRaise,
  onAttack,
  onVote,
  onTakeSpot,
  onDetails,
  className,
  style,
}: ProjectCardProps) {
  const medal = rank !== undefined && rank >= 1 && rank <= 3 ? rank : undefined;
  const actions = [onRaise, onAttack, onVote].filter(Boolean).length;
  // Описания у сайта может не быть вовсе (нет ни og:description, ни meta
  // description — так у google.com). Тогда под названием стоит сама ссылка, и
  // показывать её со схемой незачем: она тут подпись, а не адрес перехода.
  const subtitle = description ?? (url ? displayUrl(url) : undefined);
  const showTenure = rank === 1 && Boolean(heldFor);

  return (
    <article
      data-segment={segment}
      data-medal={medal}
      data-own={isOwn}
      data-pressable={Boolean(onPress)}
      className={cx(styles.card, className)}
      style={style}
      onClick={onPress}
    >
      <div className={styles.identity}>
        {rank !== undefined && <RankBadge rank={rank} delta={rankDelta} />}
        <OgPreview src={ogImage} name={name} segment={segment} size={52} />

        <div className={styles.info}>
          <div className={styles.titleRow}>
            <span className={styles.name}>{name}</span>

            {verified && (
              <Icon name="shield-check" size={13} color="var(--info-500)" title="Проверен" />
            )}

            {/* Лидерство в категории — то самое дешёвое первое место. Скрыто у
                первой строки общего топа: две короны рядом не нужны. */}
            {catLeader && rank !== 1 && (
              <span
                className={cx(styles.chip, styles.catLeader)}
                title={`Лидер категории «${catLeader}»`}
              >
                <Icon name="crown" size={10} />
                #1 {catLeader}
              </span>
            )}

            {isOwn && <span className={cx(styles.chip, styles.own)}>YOU</span>}
          </div>

          {subtitle && <p className={styles.description}>{subtitle}</p>}
        </div>
      </div>

      <div className={styles.numbers}>
        <StatBlock
          segment={segment}
          value={value}
          delta={valueDelta}
          currency={currency}
          compact={compactAmounts}
          size="lg"
          align="left"
          label={null}
          inline
        />

        {(clicks !== undefined || showTenure) && (
          <span className={styles.counters}>
            {showTenure && (
              <Counter
                title={`Держит первое место ${heldFor}`}
                icon={<Icon name="crown" size={13} color="var(--medal-1-line)" />}
              >
                {heldFor}
              </Counter>
            )}
            {clicks !== undefined && (
              <Counter
                title="Переходов на проект"
                icon={<Icon name="mouse-pointer-click" size={13} />}
                tabular
              >
                {formatCount(clicks)}
              </Counter>
            )}
          </span>
        )}
      </div>

      {spotPrice && (
        <div
          className={styles.spot}
          role={onTakeSpot ? 'button' : undefined}
          tabIndex={onTakeSpot ? 0 : undefined}
          onClick={onTakeSpot ? stop(onTakeSpot) : undefined}
          onKeyDown={
            onTakeSpot
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onTakeSpot();
                  }
                }
              : undefined
          }
        >
          <Icon name="chevrons-up" size={14} color="var(--card-accent)" />
          <span className={styles.spotLabel}>Занять это место</span>
          <span className={styles.spotPrice}>
            {spotPrice}
            {spotUnit && <span className={styles.spotUnit}>{spotUnit}</span>}
          </span>
        </div>
      )}

      {(actions > 0 || onDetails) && (
        <div className={styles.actions}>
          {onRaise && (
            <Button
              variant="paid"
              size="sm"
              icon="chevrons-up"
              className={styles.action}
              disabled={actionsDisabled}
              onClick={stop(onRaise)}
            >
              Raise
            </Button>
          )}
          {onAttack && (
            <Button
              variant="attack-quiet"
              size="sm"
              icon="swords"
              className={styles.action}
              disabled={actionsDisabled}
              onClick={stop(onAttack)}
            >
              Attack
            </Button>
          )}
          {onVote && (
            <Button
              variant="free"
              size="sm"
              icon="vote"
              className={styles.action}
              disabled={actionsDisabled}
              onClick={stop(onVote)}
            >
              Give votes
            </Button>
          )}
          {onDetails && (
            <button
              type="button"
              data-compact={actions > 0}
              className={styles.details}
              title="Подробнее"
              aria-label="Подробнее"
              onClick={stop(onDetails)}
            >
              <Icon name="list" size={15} />
              {actions ? null : 'Подробнее'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Counter({
  title,
  icon,
  tabular = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  tabular?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={styles.counter} data-tabular={tabular} title={title}>
      {icon}
      {children}
    </span>
  );
}
