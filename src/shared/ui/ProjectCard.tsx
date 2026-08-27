import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { RankBadge } from './RankBadge';
import { StatBlock } from './StatBlock';
import { OgPreview, type Segment } from './OgPreview';
import { Button } from './Button';
import { Icon } from './Icon';
import { formatCount, type DisplayCurrency } from '@/shared/lib/format';

/** Действие внутри карточки не должно открывать саму карточку. */
const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

export interface ProjectCardProps {
  segment?: Segment;
  rank?: number;
  rankDelta?: number;
  name: string;
  /** Автоописание с сайта. Если его нет, показывается ссылка. */
  description?: string;
  ogImage?: string;
  url?: string;
  value: number;
  valueDelta?: number;
  currency?: DisplayCurrency;
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
  onPress?: () => void;
  onRaise?: () => void;
  onAttack?: () => void;
  onVote?: () => void;
  onTakeSpot?: () => void;
  onDetails?: () => void;
  style?: CSSProperties;
}

/**
 * Строка рейтинга в двух полосах: сверху идентичность (позиция, превью, имя,
 * описание во всю ширину), под ней — деньги или голоса отдельной строкой.
 * Сумма никогда не конкурирует с именем за горизонталь.
 */
export function ProjectCard({
  segment = 'paid',
  rank,
  rankDelta = 0,
  name,
  description,
  ogImage,
  url,
  value,
  valueDelta,
  currency,
  clicks,
  heldFor,
  spotPrice,
  spotUnit,
  catLeader,
  isOwn = false,
  verified = false,
  onPress,
  onRaise,
  onAttack,
  onVote,
  onTakeSpot,
  onDetails,
  style,
}: ProjectCardProps) {
  const [hover, setHover] = useState(false);

  const accent = segment === 'free' ? 'var(--free-accent)' : 'var(--paid-accent)';
  const tint = segment === 'free' ? 'var(--free-tint)' : 'var(--paid-tint)';
  const tintLine = segment === 'free' ? 'var(--free-tint-border)' : 'var(--paid-tint-border)';

  /** Пьедестал: первые три несут металл и на карточке — цвет читается раньше бейджа. */
  const medal = rank !== undefined && rank >= 1 && rank <= 3 ? rank : null;
  const actions = [onRaise, onAttack, onVote].filter(Boolean).length;
  const subtitle = description ?? url;
  const btn: CSSProperties = { flex: 1, minWidth: 0, padding: '0 10px' };

  const background = isOwn
    ? tint
    : medal
      ? `linear-gradient(101deg, var(--medal-${medal}-wash) 0%, var(--surface-card) 34%)`
      : 'var(--surface-card)';

  const borderColor = medal
    ? `var(--medal-${medal}-line)`
    : isOwn
      ? tintLine
      : 'var(--border-subtle)';

  return (
    <article
      onClick={onPress}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        padding: 'var(--card-pad)',
        background,
        border: `var(--border-w) solid ${borderColor}`,
        borderRadius: 'var(--radius-card)',
        boxShadow: hover && onPress ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transition: 'box-shadow var(--dur-fast) var(--ease-out)',
        cursor: onPress ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        {rank !== undefined && <RankBadge rank={rank} delta={rankDelta} />}
        <OgPreview src={ogImage} name={name} segment={segment} size={52} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span
              style={{
                flex: '0 1 auto',
                font: 'var(--type-section)',
                color: 'var(--text-primary)',
                letterSpacing: 'var(--ls-tight)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>

            {verified && (
              <Icon name="shield-check" size={13} color="var(--info-500)" title="Проверен" />
            )}

            {/* Лидерство в категории — то самое дешёвое первое место. Показывается
                только если строка не первая в общем топе: две короны рядом не нужны. */}
            {catLeader && rank !== 1 && (
              <span
                title={`Лидер категории «${catLeader}»`}
                style={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px 1px 4px',
                  borderRadius: 'var(--radius-pill)',
                  border: `var(--border-w) solid ${tintLine}`,
                  background: tint,
                  color: accent,
                  font: 'var(--type-label)',
                  letterSpacing: 'var(--ls-caps)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon name="crown" size={10} />
                #1 {catLeader}
              </span>
            )}

            {isOwn && (
              <span
                style={{
                  flex: '0 0 auto',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-pill)',
                  background: accent,
                  color: '#fff',
                  font: 'var(--type-label)',
                  letterSpacing: 'var(--ls-caps)',
                }}
              >
                YOU
              </span>
            )}
          </div>

          {subtitle && (
            <p
              style={{
                margin: 0,
                font: 'var(--type-caption)',
                color: 'var(--text-secondary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textWrap: 'pretty',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          borderTop: 'var(--border-w) solid var(--border-subtle)',
          paddingTop: 'var(--space-5)',
        }}
      >
        <StatBlock
          segment={segment}
          value={value}
          delta={valueDelta}
          currency={currency}
          size="lg"
          align="left"
          label={null}
          inline
        />

        {/* Второстепенные счётчики собираются справа одной приглушённой группой,
            чтобы сумма держала строку за собой. */}
        {(clicks !== undefined || (rank === 1 && heldFor)) && (
          <span
            style={{
              marginLeft: 'auto',
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              color: 'var(--text-secondary)',
            }}
          >
            {rank === 1 && heldFor && (
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

      {/* Цена конкретной позиции: строка перестаёт быть числом для сравнения и
          становится тем, что можно купить. Форматирует вызывающий код. */}
      {spotPrice && (
        <div
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: '7px 10px',
            borderRadius: 'var(--radius-md)',
            background: tint,
            border: `var(--border-w) dashed ${tintLine}`,
            cursor: onTakeSpot ? 'pointer' : 'default',
          }}
        >
          <Icon name="chevrons-up" size={14} color={accent} />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              font: 'var(--type-caption)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Занять это место
          </span>
          <span
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 3,
              font: 'var(--type-amount-sm)',
              color: accent,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 'var(--ls-tight)',
            }}
          >
            {spotPrice}
            {spotUnit && (
              <span
                style={{
                  font: 'var(--type-label)',
                  letterSpacing: 'var(--ls-caps)',
                  color: 'var(--text-muted)',
                }}
              >
                {spotUnit}
              </span>
            )}
          </span>
        </div>
      )}

      {(actions > 0 || onDetails) && (
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          {onRaise && (
            <Button variant="paid" size="sm" icon="chevrons-up" style={btn} onClick={stop(onRaise)}>
              Raise
            </Button>
          )}
          {onAttack && (
            <Button
              variant="attack-quiet"
              size="sm"
              icon="swords"
              style={btn}
              onClick={stop(onAttack)}
            >
              Attack
            </Button>
          )}
          {onVote && (
            <Button variant="free" size="sm" icon="vote" style={btn} onClick={stop(onVote)}>
              Give votes
            </Button>
          )}
          {onDetails && (
            <button
              type="button"
              onClick={stop(onDetails)}
              title="Подробнее"
              aria-label="Подробнее"
              style={{
                flex: actions ? '0 0 auto' : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 36,
                padding: actions ? '0 11px' : '0 14px',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-w) solid var(--border-default)',
                background: 'var(--surface-card)',
                color: 'var(--text-secondary)',
                font: 'var(--type-micro)',
                cursor: 'pointer',
                transition: 'var(--t-control)',
              }}
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
    <span
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
    >
      {icon}
      <span
        style={{
          font: 'var(--type-amount-sm)',
          letterSpacing: 'var(--ls-tight)',
          fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
        }}
      >
        {children}
      </span>
    </span>
  );
}
