import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import {
  useFreeCategories,
  useFreeOwnPosition,
  useFreeShowcase,
  useFreeTopProject,
} from '../model';

const FREE_MIN_STEP = 1;

export function FreeMobile() {
  const { userId, voteBalance } = useSession();
  const showcase = useFreeShowcase();
  const { categories } = useFreeCategories();
  const own = useFreeOwnPosition(showcase.categoryId, userId);
  const topProjectName = useFreeTopProject();

  return (
    <ShowcaseScreen
      segment="free"
      minStep={FREE_MIN_STEP}
      categories={categories}
      topProjectName={topProjectName}
      categoryId={showcase.categoryId}
      onCategoryChange={showcase.setCategoryId}
      ownProject={own.project}
      ownRank={own.rank}
      ownNeighborAbove={own.neighborAbove}
      ownLoading={own.loading}
      voteBalance={voteBalance}
      userId={userId}
      items={showcase.items}
      loading={showcase.loading}
      loadingMore={showcase.loadingMore}
      hasMore={showcase.hasMore}
      error={showcase.error}
      onLoadMore={showcase.loadMore}
      onRetry={showcase.retry}
      onOpenProject={(item) => getPlatform().openLink(item.url)}
    />
  );
}
