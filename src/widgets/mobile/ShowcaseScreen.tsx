import { CategoryTile } from '@/shared/ui/CategoryTile';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { SkeletonFeed } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import type { IconName } from '@/shared/ui/Icon';
import {
  formatHeldDuration,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import type { CategoryStat } from '@/entities/category';
import type { ProjectListItem, ShowcaseType } from '@/entities/project';
import styles from './ShowcaseScreen.module.css';

const CATEGORY_ICON: Record<string, IconName> = {
  channels: 'send',
  bots: 'bot',
  sites: 'globe',
  business: 'briefcase',
  services: 'wrench',
};

function metricOf(item: ProjectListItem): number {
  return item.type === 'paid' ? item.paidAmount : item.votes;
}

export interface ShowcaseScreenProps {
  segment: ShowcaseType;
  currency?: DisplayCurrency;
  categories: CategoryStat[];
  categoryId: number | null;
  onCategoryChange: (id: number | null) => void;
  ownProject: ProjectListItem | null;
  ownRank: number | null;
  ownLoading: boolean;
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
 * Общая композиция Paid/Free для мобильного мини-аппа (07 Экраны.md):
 * панель «твоя позиция» → чипы/плитки категорий → лента карточек.
 * Raise/Attack/Vote/Add project ещё не подключены — это Срезы 1.4–1.7,
 * поэтому карточки сейчас только просматриваются, без действий.
 */
export function ShowcaseScreen({
  segment,
  currency = 'UZS',
  categories,
  categoryId,
  onCategoryChange,
  ownProject,
  ownRank,
  ownLoading,
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
  const poolUnit = segment === 'paid' ? undefined : 'votes';
  const formatPool = (n: number) =>
    segment === 'paid' ? formatMoney(n, { currency }) : formatVotes(n);

  return (
    <div className={styles.screen}>
      {userId && (
        <section className={styles.own}>
          {ownLoading ? (
            <SkeletonFeed rows={1} />
          ) : ownProject && ownRank !== null ? (
            <ProjectCard
              segment={segment}
              rank={ownRank}
              name={ownProject.name}
              url={ownProject.url}
              ogImage={ownProject.ogImageUrl ?? undefined}
              value={metricOf(ownProject)}
              currency={currency}
              clicks={ownProject.clicks}
              heldFor={
                ownRank === 1 && ownProject.rank1Since
                  ? formatHeldDuration(ownProject.rank1Since)
                  : undefined
              }
              isOwn
            />
          ) : (
            <EmptyState
              segment={segment}
              icon="folder-plus"
              title="У тебя пока нет записи в этом топе"
              description="Добавление проекта появится в одном из следующих срезов."
              compact
            />
          )}
        </section>
      )}

      {categories.length > 0 && (
        <section className={styles.categories}>
          <div className={styles.categoriesScroll}>
            <button
              type="button"
              className={styles.allChip}
              data-active={categoryId === null}
              onClick={() => onCategoryChange(null)}
            >
              Все категории
            </button>
            {categories.map((cat) => (
              <CategoryTile
                key={cat.categoryId}
                name={cat.title}
                icon={CATEGORY_ICON[cat.slug] ?? 'folder'}
                segment={segment}
                pool={formatPool(cat.pool)}
                unit={poolUnit}
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
        </section>
      )}

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
            icon="search-x"
            title={categoryId !== null ? 'В этой категории пока пусто' : 'Витрина пока пуста'}
            description={categoryId !== null ? 'Попробуй другую категорию.' : undefined}
          />
        ) : (
          <>
            {items.map((item, index) => (
              <ProjectCard
                key={item.id}
                segment={segment}
                rank={index + 1}
                name={item.name}
                url={item.url}
                ogImage={item.ogImageUrl ?? undefined}
                value={metricOf(item)}
                currency={currency}
                clicks={item.clicks}
                heldFor={
                  index === 0 && item.rank1Since ? formatHeldDuration(item.rank1Since) : undefined
                }
                isOwn={userId !== null && item.userId === userId}
                onPress={() => onOpenProject(item)}
              />
            ))}

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
  );
}
