import { useState } from 'react';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { createProject, registerClick } from '@/entities/project';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { AddProjectForm } from '@/widgets/mobile/AddProjectForm';
import {
  useFreeCategories,
  useFreeOwnPosition,
  useFreeShowcase,
  useFreeTopProject,
} from '../model';

export function FreeMobile() {
  const {
    userId,
    voteBalance,
    status: sessionStatus,
    errorMessage: sessionErrorMessage,
  } = useSession();
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

      <AddProjectForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories.categories}
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
