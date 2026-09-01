import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { RankBadge } from '@/shared/ui/RankBadge';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { StatBlock } from '@/shared/ui/StatBlock';
import {
  CURRENCY_SUFFIX,
  formatCount,
  formatHeldDuration,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import { displayUrl } from '@/shared/lib/url';
import { PREVIEW } from '@/shared/config/preview';
import { strings } from '@/shared/i18n/strings';
import type { ProjectListItem, ShowcaseType } from '@/entities/project';
import { PageHeader } from './PageHeader';
import { Card, Gutter, RowsCard, ScreenBody, Section } from './ScreenLayout';
import styles from './ProjectScreen.module.css';

const t = strings.project;

/** Строка ленты «что происходило со ставкой». Пока считается из витрины. */
export interface ActivityEntry {
  label: string;
  when: string;
  amount: string;
  up: boolean;
}

export interface ProjectScreenProps {
  project: ProjectListItem;
  segment: ShowcaseType;
  rank: number | null;
  categoryTitle: string | null;
  isOwn: boolean;
  currency?: DisplayCurrency;
  /** «12.5 mln» вместо «12 500 000» — настройка профиля (shared/settings). */
  compactAmounts?: boolean;
  /** Кто держит позицию и с какого месяца. Нет источника — см. PREVIEW.ownerHandle. */
  owner?: { buyer: string; since: string };
  /** Лента изменений ставки. Нет источника — см. PREVIEW.activityFeed. */
  activity?: readonly ActivityEntry[];
  /** Запись того же аккаунта в другом топе: больше одной быть не может. */
  otherEntry?: ProjectListItem | null;
  otherRank?: number | null;
  /**
   * Принадлежит ли запись в другом топе смотрящему. Считается по ней самой, а
   * не по открытой странице: тонированная подложка помечает «это твоя строка»,
   * и на чужом проекте она обязана быть обычной.
   */
  otherIsOwn?: boolean;
  onBack: () => void;
  onOpenLink: () => void;
  onRaise: () => void;
  onAttack: () => void;
  onVote: () => void;
  onOpenOther: () => void;
  onRules: () => void;
}

/**
 * Страница одного проекта — аналог страницы сайта
 * (design/ui_kits/mini_app/Screens.jsx).
 *
 * Действия видны, но пока неактивны: Raise, Attack и Vote приходят в
 * Срезах 1.5–1.7. Кнопка «открыть ссылку» работает — это единственное, что
 * проект реально обещает своим положением в топе.
 */
export function ProjectScreen({
  project,
  segment,
  rank,
  categoryTitle,
  isOwn,
  currency = 'UZS',
  compactAmounts = false,
  owner,
  activity,
  otherEntry,
  otherRank,
  otherIsOwn = false,
  onBack,
  onOpenLink,
  onRaise,
  onAttack,
  onVote,
  onOpenOther,
  onRules,
}: ProjectScreenProps) {
  const paid = segment === 'paid';
  const metric = paid ? project.paidAmount : project.votes;
  const value = paid
    ? `${formatMoney(metric, { currency, compact: compactAmounts })} ${CURRENCY_SUFFIX[currency]}`
    : formatVotes(metric, { compact: compactAmounts });

  return (
    <>
      <PageHeader
        segment={segment}
        title={project.name}
        meta={
          categoryTitle ? `${displayUrl(project.url)} · ${categoryTitle}` : displayUrl(project.url)
        }
        onBack={onBack}
        right={
          <StatBlock
            segment={segment}
            value={metric}
            currency={currency}
            compact={compactAmounts}
            label={paid ? 'BID' : 'VOTES'}
            size="md"
          />
        }
      />

      <ScreenBody>
        <Gutter>
          <Card>
            <div className={styles.identity}>
              {rank !== null && <RankBadge rank={rank} />}
              <OgPreview
                src={project.ogImageUrl ?? undefined}
                name={project.name}
                segment={segment}
                size={52}
              />
              <div className={styles.identityText}>
                <span className={styles.name}>
                  {project.name}
                  {PREVIEW.verifiedBadge && (
                    <Icon name="shield-check" size={13} color="var(--info-500)" title="Verified" />
                  )}
                </span>
                {owner && (
                  <span className={styles.owner}>{t.boughtBy(owner.buyer, owner.since)}</span>
                )}
              </div>
            </div>

            {project.ogDescription && <p className={styles.description}>{project.ogDescription}</p>}

            <div>
              {rank !== null && <KeyRow label={t.position} value={`#${rank}`} />}
              {rank === 1 && project.rank1Since && (
                <KeyRow label={t.heldAt1} value={formatHeldDuration(project.rank1Since)} />
              )}
              <KeyRow
                label={paid ? t.currentBid : t.votes}
                value={value}
                strong
                tone={paid ? 'paid' : 'free'}
              />
              <KeyRow label={t.clicks} value={formatCount(project.clicks)} />
              {PREVIEW.verifiedBadge && <KeyRow label={t.verified} value={t.yes} />}
            </div>

            <Button variant="secondary" size="md" block icon="external-link" onClick={onOpenLink}>
              {t.open(displayUrl(project.url))}
            </Button>

            <div className={styles.actions}>
              {paid && (
                <Button
                  variant="paid"
                  size="lg"
                  block
                  icon="chevrons-up"
                  // Свой платный проект поднять можно (Срез 1.5) — кнопка ведёт
                  // на вкладку Paid, где живёт сам путь оплаты. Чужой не
                  // перебивают довзносом: для этого рядом Attack.
                  disabled={!isOwn}
                  onClick={onRaise}
                >
                  {isOwn ? t.raiseMine : t.outbid}
                </Button>
              )}
              {paid && !isOwn && (
                <Button
                  variant="attack-quiet"
                  size="lg"
                  block
                  icon="swords"
                  // Ведёт на вкладку Paid и открывает шторку атаки на этом
                  // проекте (app/navigation.ts — Attack и оплата живут там,
                  // а не на карточке).
                  onClick={onAttack}
                >
                  {t.attack}
                </Button>
              )}
              {!paid && (
                <Button variant="free" size="lg" block icon="vote" disabled onClick={onVote}>
                  {t.giveVotes}
                </Button>
              )}
            </div>
          </Card>
        </Gutter>

        {PREVIEW.activityFeed && activity && activity.length > 0 && (
          <Section>
            <SectionLabel>{paid ? t.bidActivity : t.voteActivity}</SectionLabel>
            <Gutter>
              <RowsCard>
                {activity.map((entry) => (
                  <KeyRow
                    key={`${entry.label}-${entry.when}`}
                    label={`${entry.label} · ${entry.when}`}
                    value={`${entry.up ? '+' : '−'}${entry.amount}`}
                    tone={entry.up ? 'up' : 'attack'}
                  />
                ))}
              </RowsCard>
            </Gutter>
          </Section>
        )}

        <Section>
          <SectionLabel>{paid ? t.sameAccountFree : t.sameAccountPaid}</SectionLabel>
          <Gutter className={styles.otherList}>
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
                onDetails={onOpenOther}
              />
            ) : (
              <EmptyState
                icon="folder"
                segment={segment}
                title={paid ? t.noFreeEntry : t.noPaidEntry}
                description={owner ? t.otherSlotNote(owner.buyer) : undefined}
                compact
              />
            )}
          </Gutter>
        </Section>

        <Gutter>
          <Button variant="secondary" size="md" block icon="gavel" onClick={onRules}>
            {t.rulesButton}
          </Button>
        </Gutter>
      </ScreenBody>
    </>
  );
}
