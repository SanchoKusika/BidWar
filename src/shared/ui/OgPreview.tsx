import { useState, type CSSProperties } from 'react';
import { Icon } from './Icon';

export type Segment = 'paid' | 'free';

export interface OgPreviewProps {
  /** Ссылка на og:image, подтянутую с сайта проекта. */
  src?: string;
  name?: string;
  size?: number;
  radius?: string;
  segment?: Segment;
  style?: CSSProperties;
}

type State = 'loading' | 'ready' | 'empty';

/**
 * Превью подтягивается автоматически по ссылке проекта, вручную его не загрузить.
 * Отсутствующая картинка — норма, а не ошибка: сайт мог не отдать og-теги.
 * Все три состояния живут здесь, чтобы вызывающий код о них не думал.
 */
export function OgPreview({
  src,
  name = '',
  size = 64,
  radius = 'var(--radius-thumb)',
  segment = 'paid',
  style,
}: OgPreviewProps) {
  const [state, setState] = useState<State>(src ? 'loading' : 'empty');

  // Смена ссылки сбрасывает состояние загрузки прямо в рендере, а не эффектом:
  // эффект здесь дал бы лишний каскадный рендер на каждой смене превью.
  const [renderedSrc, setRenderedSrc] = useState(src);
  if (src !== renderedSrc) {
    setRenderedSrc(src);
    setState(src ? 'loading' : 'empty');
  }

  const accent = segment === 'free' ? 'var(--free-accent)' : 'var(--paid-accent)';
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        background: 'var(--surface-sunken)',
        border: 'var(--border-w) solid var(--border-subtle)',
        ...style,
      }}
    >
      {state !== 'empty' && src && (
        <img
          src={src}
          alt=""
          onLoad={() => setState('ready')}
          onError={() => setState('empty')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: state === 'ready' ? 1 : 0,
            transition: 'opacity var(--dur-base) var(--ease-out)',
          }}
        />
      )}

      {state !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              state === 'loading'
                ? 'linear-gradient(90deg,var(--skeleton-base) 8%,var(--skeleton-sheen) 18%,var(--skeleton-base) 33%)'
                : 'repeating-linear-gradient(135deg,var(--surface-sunken) 0 6px,var(--surface-inset) 6px 12px)',
            backgroundSize: state === 'loading' ? '260% 100%' : undefined,
            animation: state === 'loading' ? 'ds-skeleton 1.3s linear infinite' : undefined,
          }}
        >
          {state === 'empty' && (
            <span
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            >
              <span
                style={{
                  font: 'var(--type-amount-md)',
                  fontSize: Math.round(size * 0.34),
                  color: accent,
                  letterSpacing: 'var(--ls-tighter)',
                }}
              >
                {initial}
              </span>
              {size >= 56 && <Icon name="image-off" size={11} color="var(--text-muted)" />}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
