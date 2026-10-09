import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { brand, type DocId } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import { cx } from '@/shared/lib/cx';
import styles from './Chrome.module.css';

/**
 * The site's frame (design ui_kits/web/Chrome.jsx): top bar, page band,
 * feed-and-rail grid, footer. The kit drew them with inline styles and a
 * width hook; here they are CSS modules on tokens, and the rail's breakpoint
 * is a media query.
 */

/** Brand mark — two stacked chevrons, ink on top and the money accent below. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      strokeWidth="5.4"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={styles.mark}
    >
      <path d="M6 21 20 6l14 15" className={styles.markInk} />
      <path d="M6 34 20 19l14 15" className={styles.markAccent} />
    </svg>
  );
}

function Wordmark({ size }: { size: 'lg' | 'md' }) {
  return (
    <span className={styles.wordmark} data-size={size}>
      <Mark size={size === 'lg' ? 26 : 22} />
      <span>
        Bid<span className={styles.wordmarkAccent}>War</span>
      </span>
    </span>
  );
}

export type TopBarItem = 'paid' | 'free' | 'tasks' | 'rules';

export interface TopBarProps {
  active: TopBarItem | 'profile' | null;
  onNavigate: (item: TopBarItem) => void;
  onHome: () => void;
  /** Effective theme now — the toggle flips it. */
  dark: boolean;
  onToggleTheme: () => void;
  /** Right edge: the account button or the sign-in. */
  account: ReactNode;
}

/**
 * Identity and destinations. No balances live here: the product holds no
 * money, so there is nothing to show or top up — the same reason the mini
 * app has none.
 */
export function TopBar({ active, onNavigate, onHome, dark, onToggleTheme, account }: TopBarProps) {
  const items: Array<{ id: TopBarItem; label: string }> = [
    { id: 'paid', label: strings.showcase.paidTitle },
    { id: 'free', label: strings.showcase.freeTitle },
    { id: 'tasks', label: strings.tasks.title },
    { id: 'rules', label: strings.web.rules },
  ];

  return (
    <header className={styles.bar}>
      <div className={cx(styles.wrap, styles.barInner)}>
        <a
          href="/"
          className={styles.home}
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
        >
          <Wordmark size="lg" />
        </a>
        <nav className={styles.nav}>
          {items.map((item) => (
            <a
              key={item.id}
              href={item.id === 'paid' ? '/' : `/${item.id}`}
              data-item={item.id}
              data-active={active === item.id}
              className={styles.navItem}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onToggleTheme}
            title={strings.web.theme}
            aria-label={strings.web.theme}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={16} />
          </button>
          {account}
        </div>
      </div>
    </header>
  );
}

export type BandSegment = 'paid' | 'free' | null;

export interface PageBandProps {
  segment?: BandSegment;
  title: string;
  meta?: ReactNode;
  /** Numbers on the right — StatBlocks. */
  stat?: ReactNode;
  children?: ReactNode;
}

/** The «which economy am I in» signal, full-bleed under the bar. */
export function PageBand({ segment = null, title, meta, stat, children }: PageBandProps) {
  return (
    <div className={styles.band} data-segment={segment ?? 'none'}>
      <div className={cx(styles.wrap, styles.bandInner)}>
        <div className={styles.bandRow}>
          <div className={styles.bandText}>
            {segment && <span className={styles.pill}>{segment === 'free' ? 'FREE' : 'PAID'}</span>}
            <h1 className={styles.title}>{title}</h1>
            {meta && <span className={styles.meta}>{meta}</span>}
          </div>
          {stat && <div className={styles.bandStat}>{stat}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Feed on the left, a rail on the right that sticks under the bar from 1060px. */
export function PageGrid({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <div className={cx(styles.wrap, styles.grid)} data-rail={Boolean(rail)}>
      <main className={styles.main}>{children}</main>
      {rail && <aside className={styles.rail}>{rail}</aside>}
    </div>
  );
}

export interface RailCardProps {
  title?: string;
  footnote?: ReactNode;
  children: ReactNode;
}

export function RailCard({ title, footnote, children }: RailCardProps) {
  return (
    <section className={styles.railCard}>
      {title && <span className={styles.railTitle}>{title}</span>}
      {children}
      {footnote && <span className={styles.railNote}>{footnote}</span>}
    </section>
  );
}

/** A labelled section inside the feed column. */
export function FeedSection({
  label,
  right,
  children,
}: {
  label: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.feedSection}>
      <div className={styles.feedSectionHead}>
        <span className={styles.railTitle}>{label}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

/** One clickable row of a list in a rail card — rules, docs. */
export function RailLink({
  icon,
  label,
  active,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.railLink} data-active={active} onClick={onClick}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

const FOOTER_DOCS: readonly DocId[] = ['about', 'support', 'terms', 'privacy', 'bot'];

export function SiteFooter({ onDoc }: { onDoc: (id: DocId) => void }) {
  return (
    <footer className={styles.footer}>
      <div className={cx(styles.wrap, styles.footerTop)}>
        <Wordmark size="md" />
        <nav className={styles.footerNav}>
          {FOOTER_DOCS.map((id) => (
            <a
              key={id}
              href={`/docs/${id}`}
              className={styles.footerLink}
              onClick={(e) => {
                e.preventDefault();
                onDoc(id);
              }}
            >
              {strings.docs.tabs[id]}
            </a>
          ))}
        </nav>
      </div>
      <div className={cx(styles.wrap, styles.footerBottom)}>
        <span>
          © {brand.year} {brand.name}
        </span>
        <span>{strings.web.footerTagline}</span>
      </div>
    </footer>
  );
}
