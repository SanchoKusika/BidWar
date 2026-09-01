import { useState } from 'react';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { useSettings } from '@/shared/settings';
import { createProject, registerClick } from '@/entities/project';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { AddProjectSheet } from '@/widgets/mobile/AddProjectSheet';
import type { Navigation } from '@/app/navigation';
import {
  useFreeCategories,
  useFreeOwnPosition,
  useFreeShowcase,
  useFreeTopProject,
} from '../model';

export interface FreeMobileProps {
  nav: Navigation;
}

export function FreeMobile({ nav }: FreeMobileProps) {
  const {
    userId,
    voteBalance,
    status: sessionStatus,
    errorMessage: sessionErrorMessage,
  } = useSession();
  const { currency, compactAmounts } = useSettings();
  const showcase = useFreeShowcase();
  const categories = useFreeCategories();
  const own = useFreeOwnPosition(showcase.categoryId, userId);
  const topProject = useFreeTopProject();
  const [addOpen, setAddOpen] = useState(false);

  const refreshAfterCreate = () => {
    showcase.retry();
    categories.retry();
    topProject.retry();
    own.retry();
  };

  return (
    <>
      <ShowcaseScreen
        segment="free"
        currency={currency}
        compactAmounts={compactAmounts}
        minStep={1}
        categories={categories.categories}
        topProjectName={topProject.name}
        categoryId={showcase.categoryId}
        onCategoryChange={showcase.setCategoryId}
        ownProject={own.project}
        ownRank={own.rank}
        ownNeighborAbove={own.neighborAbove}
        ownLoading={own.loading}
        voteBalance={voteBalance}
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
        onOpenRules={() => nav.push({ name: 'rules', anchor: 'votes' })}
        onOpenProject={(item) => {
          const initData = getPlatform().getInitData();
          // Fire-and-forget: счётчик не должен задерживать переход по ссылке.
          if (initData) registerClick({ initData, projectId: item.id }).catch(() => {});
          getPlatform().openLink(item.url);
        }}
        // Своя запись уже есть — предлагать вторую бессмысленно, она всё
        // равно упадёт в 23505 (код-ревью PR #12).
        onAddProject={userId && !own.project ? () => setAddOpen(true) : undefined}
      />

      <AddProjectSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories.categories}
        taken={{ free: Boolean(own.project) }}
        onSubmit={async ({ url, categoryId }) => {
          const initData = getPlatform().getInitData();
          if (!initData) throw new Error('Открой мини-апп в Telegram, чтобы добавить проект');
          await createProject({ initData, categoryId, url });
          setAddOpen(false);
          refreshAfterCreate();
        }}
      />
    </>
  );
}
