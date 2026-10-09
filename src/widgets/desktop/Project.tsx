import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { RankBadge } from '@/shared/ui/RankBadge';
import { SkeletonBlock, SkeletonText } from '@/shared/ui/Skeleton';
import { StatBlock } from '@/shared/ui/StatBlock';
import {
  CURRENCY_SUFFIX,
  DEFAULT_CURRENCY,
  formatCount,
  formatHeldDuration,
  formatMoney,
  formatVotes,
} from '@/shared/lib/format';
import { displayUrl } from '@/shared/lib/url';
import { strings } from '@/shared/i18n/strings';
import { useSignIn } from '@/shared/lib/signIn';
import { useSession } from '@/entities/user';
import type { ShowcaseType } from '@/entities/project';
import type { ProjectScreenProps } from '@/widgets/mobile/ProjectScreen';
import { FeedSection, PageBand, PageGrid, RailCard } from './Chrome';
import styles from './Project.module.css';

function BackPill({ segment, onBack }: { segment: ShowcaseType; onBack: () => void }) {
  return (
    <button type="button" className={styles.back} onClick={onBack}>
      <Icon name="arrow-left" size={14} />
      {segment === 'paid' ? strings.web.backToPaid : strings.web.backToFree}
    </button>
  );
}

/**
 * One project on the desktop site (ui_kits/web/Pages.jsx, ProjectPage), on
 * the mini app's props. Left out from the kit because the product has no
 * source for them: «bought by» and «verified owner» (both behind PREVIEW
 * flags in the mini app), «report this project» (verification is not live).
 */
export function DesktopProject({
  project,
  segment,
  rank,
  categoryTitle,
  isOwn,
  currency = DEFAULT_CURRENCY,
  compactAmounts = false,
  activity,
  otherEntry,
  otherRank,
  otherIsOwn = false,
  onBack,
  onOpenLink,
  onRaise: raise,
  onAttack: attack,
  onOpenOther,
  onOpenOtherLink,
  onRules,
}: ProjectScreenProps) {
  const t = strings.project;
  const w = strings.web;
  const signIn = useSignIn();
  const { status } = useSession();
  // Raising or attacking needs an account; a guest is asked to sign in first.
  const gate = status === 'guest' && signIn ? signIn : null;
  const onRaise = gate ?? raise;
  const onAttack = gate ?? attack;
  const paid = segment === 'paid';
  const metric = paid ? project.paidAmount : project.votes;
  const unit = paid ? CURRENCY_SUFFIX[currency] : strings.vote.unit;
  const exact = paid ? formatMoney(metric, { currency, compact: false }) : formatVotes(metric);
  const held = rank === 1 && project.rank1Since ? formatHeldDuration(project.rank1Since) : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    navigator.clipboard
      ?.writeText(project.url)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  const stats: Array<[string, string, 'paid' | 'free' | undefined]> = [
    [t.position, rank !== null ? `#${rank}` : '—', undefined],
    [paid ? t.currentBid : t.votes, `${exact} ${unit}`, segment],
    [t.clicks, formatCount(project.clicks), undefined],
    ...(held ? [[t.heldAt1, held, undefined] as [string, string, undefined]] : []),
  ];

  return (
    <>
      <PageBand
        segment={segment}
        title={project.name}
        meta={[displayUrl(project.url), categoryTitle].filter(Boolean).join(' · ')}
        stat={
          <StatBlock
            segment={segment}
            value={metric}
            currency={currency}
            compact={compactAmounts}
            label={paid ? t.currentBid.toUpperCase() : t.votes.toUpperCase()}
            size="lg"
          />
        }
      >
        <div>
          <BackPill segment={segment} onBack={onBack} />
        </div>
      </PageBand>

      <PageGrid
        rail={
          <>
            <section className={styles.position}>
              <span className={styles.positionHead}>
                <span className={styles.positionLabel}>{t.position.toUpperCase()}</span>
                <span className={styles.positionRank}>{rank !== null ? `#${rank}` : '—'}</span>
              </span>
              <span className={styles.positionNote}>
                {paid ? w.overtakePaid(`${exact} ${unit}`) : w.overtakeFree(exact)}
              </span>
              {paid && (
                <div className={styles.positionActions}>
                  <Button variant="paid" size="lg" block icon="chevrons-up" onClick={onRaise}>
                    {isOwn ? t.raiseMine : t.raiseThis}
                  </Button>
                  {!isOwn && (
                    <Button variant="attack-quiet" size="lg" block icon="swords" onClick={onAttack}>
                      {t.attack}
                    </Button>
                  )}
                </div>
              )}
            </section>
            <RailCard>
              <Button variant="secondary" size="md" block icon="gavel" onClick={onRules}>
                {t.rulesButton}
              </Button>
            </RailCard>
          </>
        }
      >
        <section className={styles.card}>
          <div className={styles.identity}>
            <div className={styles.media}>
              <OgPreview
                src={project.ogImageUrl ?? undefined}
                name={project.name}
                segment={segment}
                size={104}
              />
              {rank !== null && <RankBadge rank={rank} />}
            </div>
            <div className={styles.body}>
              {project.ogDescription && (
                <p className={styles.description}>{project.ogDescription}</p>
              )}
              <div className={styles.stats}>
                {stats.map(([label, value, tone]) => (
                  <span key={label} className={styles.stat}>
                    <span className={styles.statLabel}>{label.toUpperCase()}</span>
                    <span className={styles.statValue} data-tone={tone}>
                      {value}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.linkRow}>
            <Button variant="primary" size="lg" icon="external-link" onClick={onOpenLink}>
              {t.open(displayUrl(project.url))}
            </Button>
            <Button variant="secondary" size="lg" icon={copied ? 'check' : 'copy'} onClick={copy}>
              {copied ? w.linkCopied : w.copyLink}
            </Button>
            <span className={styles.linkNote}>{w.clicksNote}</span>
          </div>
        </section>

        <div className={styles.columns}>
          {activity && activity.length > 0 && (
            <FeedSection label={paid ? t.bidActivity : t.voteActivity}>
              <div className={styles.rows}>
                {activity.map((entry) => (
                  <KeyRow
                    key={`${entry.label}-${entry.when}`}
                    label={`${entry.label} · ${entry.when}`}
                    value={`${entry.up ? '+' : '−'}${entry.amount}`}
                    tone={entry.up ? 'up' : 'attack'}
                  />
                ))}
              </div>
            </FeedSection>
          )}
          <FeedSection label={paid ? t.sameAccountFree : t.sameAccountPaid}>
            {otherEntry ? (
              <ProjectCard
                segment={otherEntry.type}
                rank={otherRank ?? undefined}
                name={otherEntry.name}
                url={otherEntry.url}
                description={otherEntry.ogDescription ?? undefined}
                ogImage={otherEntry.ogImageUrl ?? undefined}
                value={otherEntry.type === 'paid' ? otherEntry.paidAmount : otherEntry.votes}
                currency={currency}
                compactAmounts={compactAmounts}
                clicks={otherEntry.clicks}
                isOwn={otherIsOwn}
                onPress={onOpenOtherLink}
                onDetails={onOpenOther}
              />
            ) : (
              <EmptyState
                icon="folder"
                segment={segment}
                title={paid ? t.noFreeEntry : t.noPaidEntry}
                compact
              />
            )}
          </FeedSection>
        </div>
      </PageGrid>
    </>
  );
}

/** The project page before its answer: the same band, card and rail, values unknown. */
export function DesktopProjectSkeleton({
  segment,
  onBack,
}: {
  segment: ShowcaseType;
  onBack: () => void;
}) {
  return (
    <>
      <PageBand
        segment={segment}
        title={' '}
        meta={<SkeletonText>example.com · Category</SkeletonText>}
      >
        <div>
          <BackPill segment={segment} onBack={onBack} />
        </div>
      </PageBand>
      <PageGrid rail={<SkeletonBlock height={236} radius="var(--radius-panel)" />}>
        <section className={styles.card} aria-busy="true">
          <div className={styles.identity}>
            <div className={styles.media}>
              <SkeletonBlock width={104} height={104} radius="var(--radius-thumb)" />
            </div>
            <div className={styles.body}>
              <SkeletonText>A description line read from the project&apos;s own link</SkeletonText>
              <div className={styles.stats}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={styles.stat}>
                    <span className={styles.statLabel}>
                      <SkeletonText>POSITION</SkeletonText>
                    </span>
                    <span className={styles.statValue}>
                      <SkeletonText>000 000</SkeletonText>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </PageGrid>
    </>
  );
}
