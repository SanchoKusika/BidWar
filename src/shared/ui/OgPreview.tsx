import { useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './OgPreview.module.css';

export type Segment = 'paid' | 'free';

export interface OgPreviewProps {
  /** Ссылка на og:image, подтянутую с сайта проекта. */
  src?: string;
  name?: string;
  size?: number;
  radius?: string;
  segment?: Segment;
  className?: string;
  style?: CSSProperties;
}

type State = 'loading' | 'ready' | 'empty';

/**
 * Превью подтягивается автоматически по ссылке проекта, вручную его не загрузить.
 * Отсутствующая картинка — норма: сайт мог не отдать og-теги. Все три состояния
 * живут здесь, чтобы вызывающий код о них не думал.
 */
export function OgPreview({
  src,
  name = '',
  size = 64,
  radius = 'var(--radius-thumb)',
  segment = 'paid',
  className,
  style,
}: OgPreviewProps) {
  const [state, setState] = useState<State>(src ? 'loading' : 'empty');

  // Смена ссылки сбрасывает состояние прямо в рендере, а не эффектом: эффект
  // здесь дал бы лишний каскадный рендер на каждой смене превью.
  const [renderedSrc, setRenderedSrc] = useState(src);
  if (src !== renderedSrc) {
    setRenderedSrc(src);
    setState(src ? 'loading' : 'empty');
  }

  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <div
      data-segment={segment}
      className={cx(styles.preview, className)}
      style={{ '--og-size': `${size}px`, '--og-radius': radius, ...style } as CSSProperties}
    >
      {state !== 'empty' && src && (
        <img
          src={src}
          alt=""
          data-state={state}
          className={styles.image}
          onLoad={() => setState('ready')}
          onError={() => setState('empty')}
        />
      )}

      {state !== 'ready' && (
        <div data-state={state} className={styles.placeholder}>
          {state === 'empty' && (
            <span className={styles.fallback}>
              <span className={styles.initial}>{initial}</span>
              {size >= 56 && <Icon name="image-off" size={11} color="var(--text-muted)" />}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
