import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { useFreeCategories, useFreeOwnPosition, useFreeShowcase } from '../model';

export function FreeMobile() {
  const { userId } = useSession();
  const showcase = useFreeShowcase();
  const { categories } = useFreeCategories();
  const own = useFreeOwnPosition(showcase.categoryId, userId);

  return (
    <ShowcaseScreen
      segment="free"
      categories={categories}
      categoryId={showcase.categoryId}
      onCategoryChange={showcase.setCategoryId}
      ownProject={own.project}
      ownRank={own.rank}
      ownLoading={own.loading}
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
