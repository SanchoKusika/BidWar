import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import { Icon } from './Icon';
import { cx } from '@/shared/lib/cx';
import styles from './OgPreview.module.css';

export type Segment = 'paid' | 'free';

export interface OgPreviewProps {
  /** Картинка проекта: аватар аккаунта или иконка сайта (сервер, _shared/og.ts). */
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
 * How the picture sits in the square: a face or an icon fills it; anything
 * clearly wider or taller — a site whose only picture is its link-preview
 * banner — is shown whole instead of a slice cut from its middle.
 */
type Fit = 'cover' | 'contain';

const MAX_SQUARE_RATIO = 1.25;

/**
 * Our own platform icons (public/platforms, picked by the server for Instagram
 * and LinkedIn) are drawn for any ground: the light one under them only framed
 * them in white.
 */
function isOwnPlatformIcon(src: string): boolean {
  try {
    const url = new URL(src);
    return url.hostname === 'bidwar.world' && url.pathname.startsWith('/platforms/');
  } catch {
    return false;
  }
}

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
  const [fit, setFit] = useState<Fit>('cover');

  // Смена ссылки сбрасывает состояние прямо в рендере, а не эффектом: эффект
  // здесь дал бы лишний каскадный рендер на каждой смене превью.
  const [renderedSrc, setRenderedSrc] = useState(src);
  if (src !== renderedSrc) {
    setRenderedSrc(src);
    setState(src ? 'loading' : 'empty');
    setFit('cover');
  }

  const initial = (name.trim()[0] ?? '?').toUpperCase();

  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
    const ratio = width > 0 && height > 0 ? width / height : 1;
    setFit(ratio > MAX_SQUARE_RATIO || ratio < 1 / MAX_SQUARE_RATIO ? 'contain' : 'cover');
    setState('ready');
  };

  return (
    <div
      data-segment={segment}
      data-state={state}
      className={cx(styles.preview, className)}
      style={{ '--og-size': `${size}px`, '--og-radius': radius, ...style } as CSSProperties}
    >
      {state !== 'empty' && src && (
        <img
          src={src}
          alt=""
          data-state={state}
          data-fit={fit}
          data-ground={isOwnPlatformIcon(src) ? 'none' : undefined}
          className={styles.image}
          // The picture lives on the project's own server. Without a referrer
          // it learns nothing about which page showed it, and the servers
          // that refuse other sites' referrers (hotlink protection) serve it.
          referrerPolicy="no-referrer"
          onLoad={onLoad}
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
