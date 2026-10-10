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
  formatFullDate,
  formatShortDate,
  formatHeldDuration,
  formatMoney,
  formatVotes,
} from '@/shared/lib/format';
import { displayUrl } from '@/shared/lib/url';
import { strings } from '@/shared/i18n/strings';
import type { ShowcaseType } from '@/entities/project';
import type { ProjectScreenProps } from '@/widgets/mobile/ProjectScreen';
import { FeedSection, PageBand, PageGrid, RailCard } from './Chrome';
import styles from './Project.module.css';

/** No-break spaces: an amount must not wrap halfway across lines. */
const nowrap = (text: string) => text.replace(/\s/g, ' ');

function BackPill({ segment, onBack }: { segment: ShowcaseType; onBack: () => void }) {
  return (
    <button type="button" className={styles.back} onClick={onBack}>
      <Icon name="arrow-left" size={14} />
      {segment === 'paid' ? strings.web.backToPaid : strings.web.backToFree}
    </button>
  );
}

/**
 * One project on the desktop site (ui_kits/web/Pages.jsx, ProjectPage), on the
 * mini app's props: the band with the bid and its day change, the main card
 * with tags and the four numbers, activity and the account's other entry;
 * the rail with the position, its actions and the facts.
 *
 * Left out of the kit because the product has no source for them: «bought
 * by», «verified owner» and «report this project» — owner handles are not
 * public and verification is not live.
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
  valueDelta,
  rankDelta,
  contribution = null,
  onBack,
  onOpenLink,
  onRaise,
  onAttack,
  onVote,
  onOpenOther,
  onOpenOtherLink,
}: ProjectScreenProps) {
  const t = strings.project;
  const w = strings.web;

  const paid = segment === 'paid';
  const metric = paid ? project.paidAmount : project.votes;
  const unit = paid ? CURRENCY_SUFFIX[currency] : strings.vote.unit;
  const exact = paid ? formatMoney(metric, { currency, compact: false }) : formatVotes(metric);
  const held = rank === 1 && project.rank1Since ? formatHeldDuration(project.rank1Since) : null;
  const since = project.createdAt ? formatFullDate(project.createdAt) : null;
  // The stat tile and the tags are narrow; the facts card has room for the full date.
  const sinceShort = project.createdAt ? formatShortDate(project.createdAt) : null;
  const topName = paid ? strings.showcase.paidTitle : strings.showcase.freeTitle;
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

  // The kit's four numbers: the last one is the time at #1 for the leader and
  // the date it joined the top for everyone else.
  const stats: Array<[string, string, 'paid' | 'free' | undefined]> = [
    [t.position, rank !== null ? `#${rank}` : '—', undefined],
    [paid ? t.currentBid : t.votes, `${exact} ${unit}`, segment],
    [t.clicks, formatCount(project.clicks), undefined],
    ...(held
      ? [[t.heldAt1, held, undefined] as [string, string, undefined]]
      : sinceShort
        ? [[w.inTopSince, sinceShort, undefined] as [string, string, undefined]]
        : []),
  ];

  const tags = [categoryTitle, topName, sinceShort ? w.inTopSinceShort(sinceShort) : null].filter(
    (tag): tag is string => Boolean(tag),
  );

  const meta = [
    displayUrl(project.url),
    categoryTitle,
    sinceShort ? w.inTopSinceShort(sinceShort) : null,
    held ? w.holdingFirst(held) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageBand
        segment={segment}
        title={project.name}
        meta={meta}
        stat={
          <StatBlock
            segment={segment}
            value={metric}
            delta={valueDelta}
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
                {paid ? w.overtakePaid(nowrap(`${exact} ${unit}`)) : w.overtakeFree(nowrap(exact))}
              </span>
              <div className={styles.positionActions}>
                {paid && (
                  <Button variant="paid" size="lg" block icon="chevrons-up" onClick={onRaise}>
                    {isOwn ? t.raiseMine : t.raiseThis}
                  </Button>
                )}
                {paid && !isOwn && (
                  <Button variant="attack-quiet" size="lg" block icon="swords" onClick={onAttack}>
                    {t.attack}
                  </Button>
                )}
                {!paid && (
                  <Button variant="free" size="lg" block icon="vote" onClick={onVote}>
                    {t.giveVotes}
                  </Button>
                )}
              </div>
            </section>

            <RailCard title={w.facts}>
              <div>
                {categoryTitle && <KeyRow label={w.category} value={categoryTitle} />}
                <KeyRow label={w.top} value={topName} />
                {since && <KeyRow label={w.inTopSince} value={since} />}
                <KeyRow label={t.clicks} value={formatCount(project.clicks)} />
                {/* What this viewer has put into the bid — own raises or raises
                    of someone else's project; shown once there is any. */}
                {paid && contribution !== null && contribution > 0 && (
                  <KeyRow
                    label={w.youPutIn}
                    value={`+${formatMoney(contribution, { currency, compact: false })} ${unit}`}
                    strong
                    tone="paid"
                  />
                )}
              </div>
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
              {rank !== null && <RankBadge rank={rank} delta={rankDelta} />}
            </div>
            <div className={styles.body}>
              {project.ogDescription && (
                <p className={styles.description}>{project.ogDescription}</p>
              )}
              <div className={styles.tags}>
                {tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
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
                    key={entry.id}
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
                description={w.oneSlotEach}
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
