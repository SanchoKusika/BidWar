import { useState } from 'react';
import { CategoryTile } from '@/shared/ui/CategoryTile';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { TierDivider } from '@/shared/ui/TierDivider';
import { SkeletonFeed } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { StatBlock } from '@/shared/ui/StatBlock';
import {
  CURRENCY_SUFFIX,
  formatHeldDuration,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import { CATEGORY_ICON, type CategoryStat } from '@/entities/category';
import type { NeighborProject, ProjectListItem, ShowcaseType } from '@/entities/project';
import type { SessionStatus } from '@/entities/user';
import { ActivityFeed, type ActivityItem } from '@/shared/ui/ActivityFeed';
import { PREVIEW } from '@/shared/config/preview';
import { strings } from '@/shared/i18n/strings';
import { PageHeader } from './PageHeader';
import { HeaderAction } from './HeaderAction';
import { OwnPositionPanel } from './OwnPositionPanel';
import { ScopeToggle, type Scope } from './ScopeToggle';
import { Gutter, Section } from './ScreenLayout';
import styles from './ShowcaseScreen.module.css';

const s = strings.showcase;

// Ярусы делят длинный список на цели, к которым тянуться — чисто читательская
// подсказка, механики за ней нет (design/components/board/TierDivider.jsx).
// end — последний ранг яруса: у первых двух по 10 строк, у третьего — 30
// (21..50), поэтому цену "от" нужно брать со строки end, не rank+9 — на
// фиксированном шаге третий ярус называл "Top 50" цену 30-й строки.
const TIER_BANDS: Record<number, { label: string; end: number }> = {
  1: { label: 'Top 10', end: 10 },
  11: { label: 'Top 20', end: 20 },
  21: { label: 'Top 50', end: 50 },
};

function metricOf(item: Pick<ProjectListItem, 'type' | 'paidAmount' | 'votes'>): number {
  return item.type === 'paid' ? item.paidAmount : item.votes;
}

/**
 * Валюта показа и «сокращать ли суммы» — обе из настроек профиля, и ходят
 * вместе везде, где число попадает на экран.
 */
interface MoneyFormat {
  currency: DisplayCurrency;
  compact: boolean;
}

function formatMetric(value: number, segment: ShowcaseType, money: MoneyFormat): string {
  return segment === 'paid' ? formatMoney(value, money) : formatVotes(value, money);
}

function unitOf(segment: ShowcaseType, currency: DisplayCurrency): string {
  return segment === 'paid' ? CURRENCY_SUFFIX[currency] : 'votes';
}

type CategoryById = Map<number, CategoryStat>;

interface ScopedTotals {
  count: number;
  pool: number;
}

function totalsFor(
  categories: CategoryStat[],
  byId: CategoryById,
  categoryId: number | null,
): ScopedTotals {
  if (categoryId != null) {
    const cat = byId.get(categoryId);
    return { count: cat?.projectCount ?? 0, pool: cat?.pool ?? 0 };
  }
  return categories.reduce(
    (acc, c) => ({ count: acc.count + c.projectCount, pool: acc.pool + c.pool }),
    { count: 0, pool: 0 },
  );
}

function catLeaderOf(item: ProjectListItem, byId: CategoryById): string | undefined {
  // Сверка по id, не по имени — у projects.name нет уникальности, два
  // проекта с одинаковым названием в категории иначе получали бы корону
  // оба или не тот (код-ревью PR #10).
  const cat = byId.get(item.categoryId);
  return cat && cat.leaderId === item.id ? cat.title : undefined;
}

function tierFor(
  rank: number,
  items: ProjectListItem[],
  segment: ShowcaseType,
  money: MoneyFormat,
  unit: string,
): { label: string; note?: string } | null {
  const band = TIER_BANDS[rank];
  if (!band) return null;

  const last = items[Math.min(items.length, band.end) - 1];
  const note = last ? `from ${formatMetric(metricOf(last), segment, money)} ${unit}` : undefined;

  return { label: band.label, note };
}

function spotFor(
  item: ProjectListItem,
  segment: ShowcaseType,
  money: MoneyFormat,
  minStep: number,
  unit: string,
): { price: string; unit: string } {
  const price = metricOf(item) + minStep;
  return { price: formatMetric(price, segment, money), unit };
}

/**
 * rank и neighborAbove — два независимых запроса (useOwnPosition ловит сбой
 * каждого отдельно, см. код-ревью PR #10), поэтому "первое место" здесь
 * решается по факту rank === 1, а не по отсутствию neighborAbove — иначе
 * сбой второго запроса при rank === 5 показал бы «ты держишь первое место».
 * Когда соседа сверху посчитать не удалось, а рангов 1 тоже нет — подсказки
 * не показываем вообще: врать числом не выйти, а без числа хинт бессмыслен.
 */
function gapHint(
  rank: number | null,
  neighborAbove: NeighborProject | null,
  mine: ProjectListItem,
  segment: ShowcaseType,
  money: MoneyFormat,
  minStep: number,
  unit: string,
): string | undefined {
  if (rank === 1) {
    return segment === 'paid' ? s.holdFirstPaid : s.holdFirstFree;
  }
  // Без своего ранга нельзя назвать и позицию соседа — врать числом не станем.
  if (!neighborAbove || rank === null) return undefined;
  const diff = neighborAbove.metric - metricOf(mine) + minStep;
  const amount = formatMetric(diff, segment, money);
  return segment === 'paid'
    ? s.gapPaid(`${amount} ${unit}`, neighborAbove.name, rank - 1)
    : s.gapFree(amount, neighborAbove.name, rank - 1);
}

export interface ShowcaseScreenProps {
  segment: ShowcaseType;
  currency?: DisplayCurrency;
  /** «12.5 mln» вместо «12 500 000» — настройка профиля (shared/settings). */
  compactAmounts?: boolean;
  /** Минимальный шаг ставки/голоса — цена «занять место» и подсказки дистанции. */
  minStep: number;
  categories: CategoryStat[];
  topProjectName: string | null;
  categoryId: number | null;
  onCategoryChange: (id: number | null) => void;
  ownProject: ProjectListItem | null;
  ownRank: number | null;
  ownNeighborAbove: NeighborProject | null;
  ownLoading: boolean;
  /** Баланс голосов — только для Free Top, справа в шапке. */
  voteBalance: number | null;
  userId: string | null;
  /** 'error' — initData не прошёл проверку/сеть моргнула, показываем это явно. */
  sessionStatus: SessionStatus;
  sessionErrorMessage: string | null;
  items: ProjectListItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onOpenProject: (item: ProjectListItem) => void;
  /** Есть только на Free Top — на Paid Top вход требует оплаты (Срез 1.5), кнопка неактивна. */
  onAddProject?: () => void;
  /** Raise своей ставки — приходит с Paid Top начиная со Среза 1.5. */
  onAction?: () => void;
  onOpenRules: () => void;
  /** Лента «только что» — нет источника, см. PREVIEW.activityFeed. */
  activity?: readonly ActivityItem[];
}

/**
 * Общая композиция Paid/Free для мобильного мини-аппа — сверено с
 * design/ui_kits/mini_app/TopFeed.jsx: шапка → «твоя позиция» → плитки
 * категорий (All + по одной на категорию) → сводка топа → лента с ярусами.
 *
 * Переключатель «Today/All-time» и лента «Just happened» перенесены, но
 * скрыты за PREVIEW.todayScope/PREVIEW.activityFeed: в оригинале они читают
 * историю транзакций последних 24ч, а stake_transactions/vote_transactions
 * пока не пишутся вообще (Raise/Attack/Vote — Срезы 1.5–1.7). Переключатель
 * ничего не фильтрует — в отличие от disabled-кнопок ниже, он выглядел бы
 * рабочим, поэтому спрятан флагом, а не просто задизейблен.
 *
 * Raise подключён (Срез 1.5, onAction приходит с Paid Top); Attack/Vote ещё
 * нет — их кнопки видны (пиксель в пиксель как в ките), но неактивны до
 * своих срезов. Add project — рабочая на обоих топах (onAddProject приходит
 * от вызывающей страницы), на Paid Top вход требует оплаты (Срез 1.5).
 */
export function ShowcaseScreen({
  segment,
  currency = 'UZS',
  compactAmounts = false,
  minStep,
  categories,
  topProjectName,
  categoryId,
  onCategoryChange,
  ownProject,
  ownRank,
  ownNeighborAbove,
  ownLoading,
  voteBalance,
  userId,
  sessionStatus,
  sessionErrorMessage,
  items,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
  onOpenProject,
  onAddProject,
  onAction,
  onOpenRules,
  activity,
}: ShowcaseScreenProps) {
  const [scope, setScope] = useState<Scope>('all');
  const money: MoneyFormat = { currency, compact: compactAmounts };
  // Цена «занять это место» и «сколько нужно, чтобы обойти» — числа, по
  // которым человек платит: сокращение здесь заставит недоплатить.
  const exact: MoneyFormat = { currency, compact: false };
  const categoryById: CategoryById = new Map(categories.map((c) => [c.categoryId, c]));
  const globalTotals = totalsFor(categories, categoryById, null);
  const scopedTotals = totalsFor(categories, categoryById, categoryId);
  const unit = unitOf(segment, currency);

  const activeCategory = categoryId != null ? categoryById.get(categoryId) : undefined;
  const scopeLabel =
    categoryId === null
      ? segment === 'paid'
        ? s.paidRanking
        : s.freeRanking
      : (activeCategory?.title ?? '');

  const meta = segment === 'paid' ? s.paidMeta(globalTotals.count) : s.freeMeta(globalTotals.count);

  // Точная цена последней позиции честна, только когда список догружен целиком —
  // иначе последняя ЗАГРУЖЕННАЯ строка не обязательно последняя РЕАЛЬНАЯ.
  const lastItem = items.at(-1);
  const cheapest = !hasMore && lastItem ? spotFor(lastItem, segment, exact, minStep, unit) : null;
  const entryHint =
    segment === 'paid'
      ? cheapest
        ? s.entryHintPaid(`${cheapest.price} ${cheapest.unit}`)
        : s.entryHintPaidUnknown
      : s.entryHintFree;

  return (
    <div className={styles.screen}>
      <PageHeader
        segment={segment}
        title={segment === 'paid' ? 'Paid Top' : 'Free Top'}
        meta={meta}
        right={
          segment === 'free' && voteBalance !== null ? (
            <StatBlock segment="free" value={voteBalance} label={s.yourVotes} size="md" />
          ) : undefined
        }
        action={<HeaderAction icon="gavel" label={strings.rules.chip} onClick={onOpenRules} />}
      />

      <div className={styles.body}>
        {sessionStatus === 'error' && (
          <div className={styles.ownSkeleton}>
            <EmptyState
              icon="triangle-alert"
              title={s.signInFailed}
              description={sessionErrorMessage ?? s.signInNote}
            />
          </div>
        )}

        {userId && (
          <>
            {ownLoading ? (
              <div className={styles.ownSkeleton}>
                <SkeletonFeed rows={1} />
              </div>
            ) : (
              <OwnPositionPanel
                segment={segment}
                rank={ownRank}
                value={ownProject ? formatMetric(metricOf(ownProject), segment, money) : undefined}
                unit={unit}
                hint={
                  ownProject
                    ? gapHint(ownRank, ownNeighborAbove, ownProject, segment, exact, minStep, unit)
                    : undefined
                }
                entryHint={entryHint}
                actionLabel={segment === 'paid' ? s.raiseMine : s.voteMine}
                // На Free Top кнопка ждёт Vote (Срез 1.7) — неактивна без onAction.
                actionDisabled={!onAction}
                onAction={onAction}
                addDisabled={!onAddProject}
                onAdd={onAddProject}
              />
            )}
          </>
        )}

        {(categories.length > 0 || items.length > 0) && (
          <div className={styles.categoriesScroll}>
            <CategoryTile
              name="All"
              icon="layout-grid"
              segment={segment}
              pool={formatMetric(globalTotals.pool, segment, money)}
              unit={unit}
              projects={globalTotals.count}
              leader={topProjectName ?? undefined}
              active={categoryId === null}
              onPress={() => onCategoryChange(null)}
              className={styles.categoryTile}
            />
            {categories.map((cat) => (
              <CategoryTile
                key={cat.categoryId}
                name={cat.title}
                icon={CATEGORY_ICON[cat.slug] ?? 'folder'}
                segment={segment}
                pool={formatMetric(cat.pool, segment, money)}
                unit={unit}
                projects={cat.projectCount}
                leader={cat.leaderName ?? undefined}
                active={categoryId === cat.categoryId}
                onPress={() =>
                  onCategoryChange(categoryId === cat.categoryId ? null : cat.categoryId)
                }
                className={styles.categoryTile}
              />
            ))}
          </div>
        )}

        <div className={styles.rankingHead}>
          <span className={styles.rankingLines}>
            <span className={styles.rankingTitle}>
              {scopeLabel} · {scopedTotals.count}
            </span>
            <span className={styles.rankingSub}>
              {s.inPlay(formatMetric(scopedTotals.pool, segment, money), unit)}
            </span>
          </span>
          {PREVIEW.todayScope && (
            <ScopeToggle value={scope} onChange={setScope} segment={segment} />
          )}
        </div>

        {PREVIEW.todayScope && scope === 'today' && (
          <span className={styles.todayNote}>{s.todayNote(segment)}</span>
        )}

        <section className={styles.feed}>
          {loading ? (
            <SkeletonFeed rows={6} />
          ) : error ? (
            <EmptyState
              icon="triangle-alert"
              title={s.errorTitle}
              description={s.errorNote}
              actionLabel={s.retry}
              onAction={onRetry}
            />
          ) : items.length === 0 ? (
            <EmptyState
              segment={segment}
              icon={segment === 'paid' ? 'coins' : 'vote'}
              title={segment === 'paid' ? s.emptyPaidTitle : s.emptyFreeTitle}
              description={segment === 'paid' ? s.emptyPaidNote : s.emptyFreeNote}
              actionLabel={onAddProject ? strings.profile.addProject : undefined}
              onAction={onAddProject}
              compact
            />
          ) : (
            <>
              {items.map((item, index) => {
                const rank = index + 1;
                // Ярусы имеют смысл только в общем разрезе — внутри категории
                // позиции уже пересчитаны как 1..N её собственного списка.
                const tier =
                  categoryId === null ? tierFor(rank, items, segment, money, unit) : null;
                const isOwn = userId !== null && item.userId === userId;
                const spot = !isOwn ? spotFor(item, segment, exact, minStep, unit) : null;

                return (
                  <div key={item.id} className={styles.row}>
                    {tier && (
                      <TierDivider
                        label={tier.label}
                        note={tier.note}
                        icon={rank === 1 ? 'trophy' : undefined}
                      />
                    )}
                    <ProjectCard
                      segment={segment}
                      rank={rank}
                      name={item.name}
                      url={item.url}
                      description={item.ogDescription ?? undefined}
                      ogImage={item.ogImageUrl ?? undefined}
                      value={metricOf(item)}
                      currency={currency}
                      compactAmounts={compactAmounts}
                      clicks={item.clicks}
                      heldFor={
                        rank === 1 && item.rank1Since
                          ? formatHeldDuration(item.rank1Since)
                          : undefined
                      }
                      catLeader={catLeaderOf(item, categoryById)}
                      spotPrice={spot?.price}
                      spotUnit={spot?.unit}
                      isOwn={isOwn}
                      onPress={() => onOpenProject(item)}
                    />
                  </div>
                );
              })}

              {hasMore && (
                <Button
                  variant="secondary"
                  onClick={onLoadMore}
                  loading={loadingMore}
                  block
                  className={styles.loadMore}
                >
                  {s.loadMore}
                </Button>
              )}
            </>
          )}
        </section>

        {PREVIEW.activityFeed && activity && activity.length > 0 && (
          <Section>
            <Gutter>
              <ActivityFeed dense max={5} title={s.justHappened} items={[...activity]} />
            </Gutter>
          </Section>
        )}
      </div>
    </div>
  );
}
