import { useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import { ProjectCard, ProjectCardSkeleton } from '@/shared/ui/ProjectCard';
import { ReferralShareCard } from '@/shared/ui/ReferralShareCard';
import { SkeletonText } from '@/shared/ui/Skeleton';
import { StatBlock } from '@/shared/ui/StatBlock';
import {
  CURRENCY_SUFFIX,
  DEFAULT_CURRENCY,
  formatCharged,
  formatMoney,
  formatVotes,
} from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import type { ProfileScreenProps } from '@/widgets/mobile/ProfileScreen';
import { SettingsPanel } from '@/widgets/mobile/SettingsPanel';
import { FeedSection, PageBand, PageGrid, RailCard } from './Chrome';
import styles from './Profile.module.css';

const RECEIPT_PLACEHOLDERS = [184, 148, 168] as const;

/**
 * The profile on the desktop site (ui_kits/web/Pages.jsx, ProfilePage), on the
 * mini app's props. Votes, money paid and receipts move to the rail; projects,
 * the referral card and settings stay in the feed. From the kit's settings
 * only what the product has: no currency switch, no «confirm every payment»,
 * no weekly digest, no account deletion — and «sign out» only where a sign-in
 * is kept, on the site.
 */
export function DesktopProfile({
  name,
  username,
  joined,
  avatarUrl,
  voteBalance,
  voteBalanceLoading = false,
  spending,
  projects,
  onRefresh,
  refreshing = false,
  referralLink,
  referralInvited,
  referralEarned,
  referralReward,
  onShareReferral,
  currency = DEFAULT_CURRENCY,
  compactAmounts = false,
  settings,
  onEarn,
  projectsLoading = false,
  spendingLoading = false,
  referralLoading = false,
  referralFocus = null,
  onAdd,
  onOpenProject,
  onRaise,
  onVote,
}: ProfileScreenProps) {
  const t = strings.profile;
  const money = (v: number) => formatMoney(v, { currency, compact: compactAmounts });
  const unit = CURRENCY_SUFFIX[currency];
  const showSpending = Boolean(spending) || spendingLoading;
  const referralRef = useRef<HTMLDivElement>(null);
  const handledFocus = useRef<object | null>(null);

  useEffect(() => {
    if (!referralFocus || handledFocus.current === referralFocus) return;
    if (projectsLoading || referralLoading) return;
    handledFocus.current = referralFocus;
    referralRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [referralFocus, projectsLoading, referralLoading]);

  return (
    <>
      <PageBand
        title={name}
        meta={t.meta(name, username, joined)}
        stat={
          <>
            {voteBalance !== null || voteBalanceLoading ? (
              <StatBlock
                segment="free"
                value={voteBalance ?? 0}
                label={t.votesLabel}
                size="lg"
                showUnit={false}
                loading={voteBalance === null}
              />
            ) : null}
            <OgPreview
              src={avatarUrl ?? undefined}
              name={name}
              size={64}
              radius="var(--radius-pill)"
            />
          </>
        }
      />

      <PageGrid
        rail={
          <>
            <RailCard title={t.votesLabel} footnote={strings.web.votesFootnote}>
              <div>
                <KeyRow
                  label={strings.web.availableNow}
                  value={
                    voteBalance !== null ? (
                      formatVotes(voteBalance, { compact: compactAmounts })
                    ) : voteBalanceLoading ? (
                      <SkeletonText>000</SkeletonText>
                    ) : (
                      '—'
                    )
                  }
                  strong
                  tone="free"
                />
              </div>
              <Button variant="free" size="md" block icon="list-checks" onClick={onEarn}>
                {t.earn}
              </Button>
            </RailCard>

            {showSpending && (
              <RailCard title={strings.web.moneyPaid} footnote={t.noWallet}>
                <div>
                  <KeyRow
                    label={t.paidLast30}
                    value={
                      spending ? (
                        `${money(spending.month)} ${unit}`
                      ) : (
                        <SkeletonText>000 000 {unit}</SkeletonText>
                      )
                    }
                    strong
                    tone="paid"
                  />
                  <KeyRow
                    label={strings.web.allTime}
                    value={
                      spending ? (
                        `${money(spending.total)} ${unit}`
                      ) : (
                        <SkeletonText>000 000 {unit}</SkeletonText>
                      )
                    }
                  />
                </div>
              </RailCard>
            )}

            {showSpending && (
              <RailCard title={t.receipts}>
                <div aria-busy={!spending}>
                  {!spending ? (
                    RECEIPT_PLACEHOLDERS.map((width) => (
                      <KeyRow
                        key={width}
                        label={<SkeletonText width={width} />}
                        value={<SkeletonText>−000 000</SkeletonText>}
                      />
                    ))
                  ) : spending.receipts.length > 0 ? (
                    spending.receipts.map((r) => (
                      <KeyRow
                        key={r.id}
                        label={`${r.label} · ${r.when}${r.provider ? ` · ${r.provider}` : ''}`}
                        // Charged as is: a receipt is never converted (04 Платежи и валюты).
                        value={`−${formatCharged(r.charged, r.currency)}`}
                        tone={r.kind === 'attack' ? 'attack' : undefined}
                      />
                    ))
                  ) : (
                    <span className={styles.note}>{t.noReceipts}</span>
                  )}
                </div>
              </RailCard>
            )}
          </>
        }
      >
        <FeedSection
          label={t.myProjects}
          right={
            <span className={styles.sectionActions}>
              {onRefresh && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={onRefresh}
                  disabled={refreshing}
                >
                  <Icon name="rotate-ccw" size={13} />
                  {t.refresh}
                </button>
              )}
              {onAdd ? (
                <button type="button" className={styles.textButton} onClick={onAdd}>
                  <Icon name="plus" size={13} />
                  {t.add}
                </button>
              ) : projects.length >= 2 ? (
                <span className={styles.note}>{t.bothSlotsUsed}</span>
              ) : null}
            </span>
          }
        >
          <div className={styles.projects}>
            {projectsLoading && projects.length === 0 ? (
              <ProjectCardSkeleton own actions={1} />
            ) : projects.length > 0 ? (
              projects.map(({ project, rank }) => (
                <ProjectCard
                  key={`${project.type}-${project.id}`}
                  segment={project.type}
                  rank={rank ?? undefined}
                  name={project.name}
                  url={project.url}
                  description={project.ogDescription ?? undefined}
                  ogImage={project.ogImageUrl ?? undefined}
                  value={project.type === 'paid' ? project.paidAmount : project.votes}
                  currency={currency}
                  compactAmounts={compactAmounts}
                  clicks={project.clicks}
                  isOwn
                  onDetails={() => onOpenProject(project)}
                  onRaise={project.type === 'paid' ? () => onRaise(project) : undefined}
                  onVote={project.type === 'free' ? () => onVote(project) : undefined}
                />
              ))
            ) : (
              <EmptyState
                icon="folder-plus"
                title={t.noProjectsTitle}
                description={t.noProjectsNote}
                actionLabel={onAdd ? t.addProject : undefined}
                onAction={onAdd}
                compact
              />
            )}
          </div>
        </FeedSection>

        <div ref={referralRef}>
          <ReferralShareCard
            link={referralLink}
            invited={referralInvited}
            earned={referralEarned}
            rewardPerInvite={referralReward}
            onShare={onShareReferral}
            loading={referralLoading}
          />
        </div>

        <FeedSection label={strings.web.settings}>
          <SettingsPanel {...settings} className={styles.settings} />
        </FeedSection>
      </PageGrid>
    </>
  );
}
