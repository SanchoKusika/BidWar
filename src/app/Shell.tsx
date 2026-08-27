import { useEffect, useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { bindTheme } from './theme';

/**
 * Каркас. Экраны появятся в следующих срезах — пока проверяется, что
 * дизайн-система, слой platform и сборка работают вместе на обеих площадках.
 */
export function Shell() {
  const platform = getPlatform();
  const [scheme, setScheme] = useState(platform.getColorScheme());

  useEffect(() => {
    platform.ready();
    const unbindTheme = bindTheme(platform);
    const unsubscribe = platform.onColorSchemeChange(setScheme);
    return () => {
      unbindTheme();
      unsubscribe();
    };
  }, [platform]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        font: 'var(--type-body)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--card-pad-lg)',
          background: 'var(--surface-card)',
          border: 'var(--border-w) solid var(--border-subtle)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <h1
          style={{
            margin: 0,
            font: 'var(--fw-bold) var(--fs-24)/var(--lh-tight) var(--font-display)',
            letterSpacing: 'var(--ls-tighter)',
          }}
        >
          Bid<span style={{ color: 'var(--paid-accent)' }}>War</span>
        </h1>
        <Row label="ПЛОЩАДКА" value={platform.name} />
        <Row label="ТЕМА" value={scheme} />
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span
        style={{
          font: 'var(--type-label)',
          letterSpacing: 'var(--ls-caps)',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: 'var(--type-amount-sm)',
          fontFamily: 'var(--font-numeric)',
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
