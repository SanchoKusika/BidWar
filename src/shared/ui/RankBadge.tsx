import type { CSSProperties } from 'react';
import { Icon } from './Icon';

/**
 * Позиция в топе. Первые три — «горячие»: силуэт пламени в своём металле, так
 * что ранг читается по цвету раньше, чем по цифре. Габарит одинаков на любом
 * месте, поэтому колонка бейджей никогда не съезжает.
 *
 * Исходник силуэта — assets/flame.svg, вставлен маской: так он берёт градиент
 * и работает на любой глубине страницы.
 */
const FLAME =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21C16.4183 21 20 17.6439 20 13.504C20 9.76257 17.9654 6.83811 16.562 5.44436C16.3017 5.18584 15.8683 5.30006 15.7212 5.63288C14.9742 7.3229 13.4178 9.75607 11.4286 9.75607C10.1975 9.92086 8.31688 8.86844 9.83483 3.64868C9.97151 3.17868 9.46972 2.80113 9.08645 3.11539C6.9046 4.90436 4 8.51143 4 13.504C4 17.6439 7.58172 21 12 21Z' fill='%23000'/%3E%3C/svg%3E\")";

interface Medal {
  name: string;
  scale: number;
  dur: string;
  core: string;
  halo: string;
  haloOn: number;
  glowBlur: number;
}

/**
 * Периоды намеренно неравные: колонка из трёх бейджей не должна пульсировать
 * в унисон. Золото горит крупнее и быстрее, бронза мельче и медленнее.
 */
const MEDALS: Record<number, Medal> = {
  1: {
    name: 'Gold',
    scale: 1.38,
    dur: '1.9s',
    core: '1.15s',
    halo: '2.6s',
    haloOn: 1,
    glowBlur: 7,
  },
  2: {
    name: 'Silver',
    scale: 1.32,
    dur: '2.3s',
    core: '1.45s',
    halo: '3.1s',
    haloOn: 0.7,
    glowBlur: 5,
  },
  3: {
    name: 'Bronze',
    scale: 1.26,
    dur: '2.7s',
    core: '1.75s',
    halo: '3.6s',
    haloOn: 0.55,
    glowBlur: 4,
  },
};

const medalVar = (rank: number, part: string) => `var(--medal-${rank}-${part})`;

export interface RankBadgeProps {
  rank: number;
  /** Изменение позиции с прошлого просмотра. */
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
  showDelta?: boolean;
  style?: CSSProperties;
}

export function RankBadge({
  rank,
  delta = 0,
  size = 'md',
  showDelta = true,
  style,
}: RankBadgeProps) {
  const medal = MEDALS[rank];
  const dim = size === 'sm' ? 26 : size === 'lg' ? 40 : 32;
  const d = Number(delta) || 0;
  const dirColor = d > 0 ? 'var(--delta-up)' : d < 0 ? 'var(--delta-down)' : 'var(--delta-flat)';
  const body = medal ? Math.round(dim * medal.scale) : 0;

  const mask: CSSProperties = {
    WebkitMaskImage: FLAME,
    maskImage: FLAME,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    transformOrigin: '50% 78%',
  };

  const digitSize = medal
    ? size === 'lg'
      ? 'var(--fs-24)'
      : size === 'sm'
        ? 'var(--fs-15)'
        : 'var(--fs-18)'
    : size === 'lg'
      ? 'var(--fs-18)'
      : size === 'sm'
        ? 'var(--fs-13)'
        : 'var(--fs-15)';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, ...style }}
    >
      <div
        title={medal ? `${medal.name} — место ${rank}` : undefined}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: dim,
          height: dim,
          padding: '0 6px',
          borderRadius: medal ? 0 : 'var(--radius-md)',
          background: medal ? 'transparent' : 'var(--rank-default-tint)',
          color: medal ? medalVar(rank, 'ink') : 'var(--rank-default-text)',
        }}
      >
        {medal && (
          <>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '54%',
                width: Math.round(dim * 2),
                height: Math.round(dim * 2),
                transform: 'translate(-50%,-50%)',
                background: `radial-gradient(circle, ${medalVar(rank, 'glow')} 0%, transparent 66%)`,
                opacity: medal.haloOn,
                animation: `ds-flame-halo ${medal.halo} var(--ease-in-out) infinite`,
                pointerEvents: 'none',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                ...mask,
                width: body,
                height: body,
                transform: 'translate(-50%,-50%)',
                backgroundImage: `linear-gradient(166deg, ${medalVar(rank, 'hi')} 2%, ${medalVar(rank, 'mid')} 48%, ${medalVar(rank, 'lo')} 100%)`,
                filter: `drop-shadow(0 1px ${medal.glowBlur}px ${medalVar(rank, 'glow')})`,
                animation: `ds-flame-breathe ${medal.dur} var(--ease-in-out) infinite`,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                ...mask,
                width: Math.round(body * 0.52),
                height: Math.round(body * 0.52),
                top: '58%',
                transform: 'translate(-50%,-50%)',
                background: medalVar(rank, 'hi'),
                mixBlendMode: 'soft-light',
                animation: `ds-flame-core ${medal.core} var(--ease-in-out) infinite`,
              }}
            />
          </>
        )}
        <span
          style={{
            position: 'relative',
            font: 'var(--type-rank)',
            fontSize: digitSize,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 'var(--ls-tight)',
            marginTop: medal ? Math.round(dim * 0.13) : 0,
          }}
        >
          {rank}
        </span>
      </div>

      {showDelta && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            color: dirColor,
            font: 'var(--type-label)',
            letterSpacing: 'var(--ls-wide)',
          }}
        >
          {d !== 0 && <Icon name={d > 0 ? 'arrow-up' : 'arrow-down'} size={9} />}
          {d === 0 ? '—' : Math.abs(d)}
        </span>
      )}
    </div>
  );
}
