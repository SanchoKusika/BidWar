import type { CSSProperties } from 'react';

const shimmer: CSSProperties = {
  background:
    'linear-gradient(90deg,var(--skeleton-base) 8%,var(--skeleton-sheen) 18%,var(--skeleton-base) 33%)',
  backgroundSize: '260% 100%',
  animation: 'ds-skeleton 1.3s linear infinite',
  borderRadius: 'var(--radius-xs)',
};

function Bar({
  w,
  h = 10,
  r = 'var(--radius-xs)',
}: {
  w: number | string;
  h?: number;
  r?: string;
}) {
  return <span style={{ ...shimmer, display: 'block', width: w, height: h, borderRadius: r }} />;
}

/**
 * Заглушка загрузки, повторяющая геометрию ProjectCard, — лента не должна
 * прыгать в момент, когда приходят данные. Спиннеров в ленте не бывает.
 */
export function SkeletonCard({
  showActions = false,
  style,
}: {
  showActions?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        padding: 'var(--card-pad)',
        background: 'var(--surface-card)',
        border: 'var(--border-w) solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <Bar w={32} h={32} r="var(--radius-md)" />
        <Bar w={52} h={52} r="var(--radius-thumb)" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Bar w="58%" h={12} />
          <Bar w="88%" h={9} />
          <Bar w="40%" h={9} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <Bar w={28} h={8} />
          <Bar w={72} h={16} r="var(--radius-sm)" />
        </div>
      </div>

      {showActions && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            borderTop: 'var(--border-w) solid var(--border-subtle)',
            paddingTop: 'var(--space-5)',
          }}
        >
          <Bar w="50%" h={36} r="var(--radius-control)" />
          <Bar w="50%" h={36} r="var(--radius-control)" />
        </div>
      )}
    </div>
  );
}

export function SkeletonFeed({
  rows = 4,
  showActions = false,
  style,
}: {
  rows?: number;
  showActions?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-busy="true"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--stack-gap)', ...style }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} showActions={showActions} style={{ opacity: 1 - i * 0.14 }} />
      ))}
    </div>
  );
}
