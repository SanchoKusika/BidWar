import type { Navigation } from '@/app/navigation';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { registerClick } from '@/entities/project';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import {
  usePaidCategories,
  usePaidOwnPosition,
  usePaidShowcase,
  usePaidTopProject,
  useMinPaidAmount,
} from '../model';

export interface PaidMobileProps {
  nav: Navigation;
}

export function PaidMobile({ nav }: PaidMobileProps) {
  const { userId, status: sessionStatus, errorMessage: sessionErrorMessage } = useSession();
  const showcase = usePaidShowcase();
  const categories = usePaidCategories();
  const own = usePaidOwnPosition(showcase.categoryId, userId);
  const topProject = usePaidTopProject();
  const minStep = useMinPaidAmount();

  return (
    <ShowcaseScreen
      segment="paid"
      minStep={minStep}
      categories={categories.categories}
      topProjectName={topProject.name}
      categoryId={showcase.categoryId}
      onCategoryChange={showcase.setCategoryId}
      ownProject={own.project}
      ownRank={own.rank}
      ownNeighborAbove={own.neighborAbove}
      ownLoading={own.loading}
      voteBalance={null}
      userId={userId}
      sessionStatus={sessionStatus}
      sessionErrorMessage={sessionErrorMessage}
      items={showcase.items}
      loading={showcase.loading}
      loadingMore={showcase.loadingMore}
      hasMore={showcase.hasMore}
      error={showcase.error}
      onLoadMore={showcase.loadMore}
      onRetry={showcase.retry}
      onOpenRules={() => nav.push({ name: 'rules', anchor: 'bidding' })}
      onOpenProject={(item) => {
        const initData = getPlatform().getInitData();
        if (initData) registerClick({ initData, projectId: item.id }).catch(() => {});
        getPlatform().openLink(item.url);
      }}
      // Paid-вход требует оплаты (Срез 1.5) — Add project тут не подключён.
    />
  );
}
