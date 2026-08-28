import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import {
  usePaidCategories,
  usePaidOwnPosition,
  usePaidShowcase,
  usePaidTopProject,
  useMinPaidAmount,
} from '../model';

export function PaidMobile() {
  const { userId } = useSession();
  const showcase = usePaidShowcase();
  const { categories } = usePaidCategories();
  const own = usePaidOwnPosition(showcase.categoryId, userId);
  const topProjectName = usePaidTopProject();
  const minStep = useMinPaidAmount();

  return (
    <ShowcaseScreen
      segment="paid"
      minStep={minStep}
      categories={categories}
      topProjectName={topProjectName}
      categoryId={showcase.categoryId}
      onCategoryChange={showcase.setCategoryId}
      ownProject={own.project}
      ownRank={own.rank}
      ownNeighborAbove={own.neighborAbove}
      ownLoading={own.loading}
      voteBalance={null}
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
