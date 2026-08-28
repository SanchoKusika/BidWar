import { CategoryTile } from '@/shared/ui/CategoryTile';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { TierDivider } from '@/shared/ui/TierDivider';
import { SkeletonFeed } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { StatBlock } from '@/shared/ui/StatBlock';
import type { IconName } from '@/shared/ui/Icon';
import {
  CURRENCY_SUFFIX,
  formatHeldDuration,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import type { CategoryStat } from '@/entities/category';
import type { NeighborProject, ProjectListItem, ShowcaseType } from '@/entities/project';
import { PageHeader } from './PageHeader';
import { OwnPositionPanel } from './OwnPositionPanel';
import styles from './ShowcaseScreen.module.css';

const CATEGORY_ICON: Record<string, IconName> = {
  channels: 'send',
  bots: 'bot',
  sites: 'globe',
  business: 'briefcase',
  services: 'wrench',
};

// Ярусы делят длинный список на цели, к которым тянуться — чисто читательская
// подсказка, механики за ней нет (design/components/board/TierDivider.jsx).
const TIER_BANDS: Record<number, string> = { 1: 'Top 10', 11: 'Top 20', 21: 'Top 50' };

function metricOf(item: Pick<ProjectListItem, 'type' | 'paidAmount' | 'votes'>): number {
  return item.type === 'paid' ? item.paidAmount : item.votes;
}

function formatMetric(value: number, segment: ShowcaseType, currency: DisplayCurrency): string {
  return segment === 'paid'
    ? formatMoney(value, { currency, compact: false })
    : formatVotes(value, { compact: false });
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
  const cat = byId.get(item.categoryId);
  return cat && cat.leaderName === item.name ? cat.title : undefined;
}

function tierFor(
  rank: number,
  items: ProjectListItem[],
  segment: ShowcaseType,
  currency: DisplayCurrency,
  unit: string,
): { label: string; note?: string } | null {
  const label = TIER_BANDS[rank];
  if (!label) return null;

  const last = items[Math.min(items.length, rank + 9) - 1];
  const note = last ? `from ${formatMetric(metricOf(last), segment, currency)} ${unit}` : undefined;

  return { label, note };
}

function spotFor(
  item: ProjectListItem,
  segment: ShowcaseType,
  currency: DisplayCurrency,
  minStep: number,
  unit: string,
): { price: string; unit: string } {
  const price = metricOf(item) + minStep;
  return { price: formatMetric(price, segment, currency), unit };
}

function gapHint(
  neighborAbove: NeighborProject | null,
  mine: ProjectListItem,
  segment: ShowcaseType,
  currency: DisplayCurrency,
  minStep: number,
  unit: string,
): string {
  if (!neighborAbove) {
    return segment === 'paid'
      ? 'Ты держишь первое место. Любой рейз только увеличит отрыв.'
      : 'Ты держишь первое место. Продолжай собирать голоса.';
  }
  const diff = neighborAbove.metric - metricOf(mine) + minStep;
  return segment === 'paid'
    ? `Подними ставку на ${formatMetric(diff, segment, currency)} ${unit}, чтобы обойти «${neighborAbove.name}».`
    : `Нужно ещё ${formatMetric(diff, segment, currency)} голосов, чтобы обойти «${neighborAbove.name}».`;
}

export interface ShowcaseScreenProps {
  segment: ShowcaseType;
  currency?: DisplayCurrency;
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
  items: ProjectListItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onOpenProject: (item: ProjectListItem) => void;
}

/**
 * Общая композиция Paid/Free для мобильного мини-аппа — сверено с
 * design/ui_kits/mini_app/TopFeed.jsx: шапка → «твоя позиция» → плитки
 * категорий (All + по одной на категорию) → сводка топа → лента с ярусами.
 *
 * Осознанно не перенесено: переключатель «Today/All-time» и лента «Just
 * happened» — в оригинале они читают историю транзакций последних 24ч,
 * а stake_transactions/vote_transactions пока не пишутся вообще (Raise/
 * Attack/Vote — Срезы 1.5–1.7). Подделывать эти данные не стал.
 *
 * Raise/Attack/Vote/Add project ещё не подключены — кнопки видны (пиксель
 * в пиксель как в ките), но неактивны до своих срезов.
 */
export function ShowcaseScreen({
  segment,
  currency = 'UZS',
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
  items,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
  onOpenProject,
}: ShowcaseScreenProps) {
  const categoryById: CategoryById = new Map(categories.map((c) => [c.categoryId, c]));
  const globalTotals = totalsFor(categories, categoryById, null);
  const scopedTotals = totalsFor(categories, categoryById, categoryId);
  const unit = unitOf(segment, currency);

  const activeCategory = categoryId != null ? categoryById.get(categoryId) : undefined;
  const scopeLabel =
    categoryId === null
      ? segment === 'paid'
        ? 'Paid ranking'
        : 'Free ranking'
      : (activeCategory?.title ?? '');

  const meta =
    segment === 'paid'
      ? `${globalTotals.count} projects · money never converts to votes`
      : `${globalTotals.count} projects · votes never convert to money`;

  // Точная цена последней позиции честна, только когда список догружен целиком —
  // иначе последняя ЗАГРУЖЕННАЯ строка не обязательно последняя РЕАЛЬНАЯ.
  const lastItem = items.at(-1);
  const cheapest =
    !hasMore && lastItem ? spotFor(lastItem, segment, currency, minStep, unit) : null;
  const entryHint =
    segment === 'paid'
      ? cheapest
        ? `Последняя позиция в топе стоит ${cheapest.price} ${cheapest.unit}. Добавь проект и поднимайся выше.`
        : 'Добавь проект и сделай первую ставку.'
      : 'Бесплатный старт — с нуля голосов. Задания дают голоса, чтобы подниматься.';

  return (
    <div className={styles.screen}>
      <PageHeader
        segment={segment}
        title={segment === 'paid' ? 'Paid Top' : 'Free Top'}
        meta={meta}
        right={
          segment === 'free' && voteBalance !== null ? (
            <StatBlock segment="free" value={voteBalance} label="YOUR VOTES" size="md" />
          ) : undefined
        }
      />

      <div className={styles.body}>
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
                value={
                  ownProject ? formatMetric(metricOf(ownProject), segment, currency) : undefined
                }
                unit={unit}
                hint={
                  ownProject
                    ? gapHint(ownNeighborAbove, ownProject, segment, currency, minStep, unit)
                    : undefined
                }
                entryHint={entryHint}
                actionLabel={segment === 'paid' ? 'Raise my bid' : 'Give votes to my project'}
                // Raise/Vote ещё не подключены (1.5/1.7) — кнопка на месте, но неактивна.
                actionDisabled
                addDisabled
                onAdd={undefined}
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
              pool={formatMetric(globalTotals.pool, segment, currency)}
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
                pool={formatMetric(cat.pool, segment, currency)}
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
              {formatMetric(scopedTotals.pool, segment, currency)} {unit} in play
            </span>
          </span>
        </div>

        <section className={styles.feed}>
          {loading ? (
            <SkeletonFeed rows={6} />
          ) : error ? (
            <EmptyState
              icon="triangle-alert"
              title="Не удалось загрузить витрину"
              description="Проверь связь и попробуй ещё раз."
              actionLabel="Повторить"
              onAction={onRetry}
            />
          ) : items.length === 0 ? (
            <EmptyState
              segment={segment}
              icon={segment === 'paid' ? 'coins' : 'vote'}
              title={categoryId !== null ? 'В этой категории пока пусто' : 'Витрина пока пуста'}
              description={categoryId !== null ? 'Попробуй другую категорию.' : undefined}
            />
          ) : (
            <>
              {items.map((item, index) => {
                const rank = index + 1;
                // Ярусы имеют смысл только в общем разрезе — внутри категории
                // позиции уже пересчитаны как 1..N её собственного списка.
                const tier =
                  categoryId === null ? tierFor(rank, items, segment, currency, unit) : null;
                const isOwn = userId !== null && item.userId === userId;
                const spot = !isOwn ? spotFor(item, segment, currency, minStep, unit) : null;

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
                      ogImage={item.ogImageUrl ?? undefined}
                      value={metricOf(item)}
                      currency={currency}
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
                  Показать ещё
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
