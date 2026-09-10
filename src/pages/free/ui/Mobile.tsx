import { useState } from 'react';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { useSettings } from '@/shared/settings';
import { createProject, registerClick, type ProjectListItem } from '@/entities/project';
import { toVoteActivityItems, useRecentVotes } from '@/entities/activity';
import { castVotes } from '@/features/vote';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { AddProjectSheet } from '@/widgets/mobile/AddProjectSheet';
import { VoteSheet } from '@/widgets/mobile/VoteSheet';
import type { Scope } from '@/widgets/mobile/ScopeToggle';
import type { Navigation } from '@/app/navigation';
import {
  useFreeCategories,
  useFreeOwnPosition,
  useFreeShowcase,
  useFreeToday,
  useFreeTopProject,
} from '../model';

export interface FreeMobileProps {
  nav: Navigation;
}

interface VoteTarget {
  project: ProjectListItem;
  rank: number | null;
}

export function FreeMobile({ nav }: FreeMobileProps) {
  const {
    userId,
    voteBalance,
    applyVoteBalance,
    status: sessionStatus,
    errorMessage: sessionErrorMessage,
  } = useSession();
  const { currency, compactAmounts } = useSettings();
  const showcase = useFreeShowcase();
  const categories = useFreeCategories();
  const own = useFreeOwnPosition(showcase.categoryId, userId);
  const topProject = useFreeTopProject();
  const [scope, setScope] = useState<Scope>('all');
  const today = useFreeToday(scope === 'today', showcase.categoryId);
  const activity = useRecentVotes(true);
  const [addOpen, setAddOpen] = useState(false);
  const [voteTarget, setVoteTarget] = useState<VoteTarget | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const refreshBoard = () => {
    showcase.retry();
    categories.retry();
    topProject.retry();
    own.retry();
    today.retry();
    activity.retry();
  };

  // Голосовать можно только зная, чей голос: баланс приходит из сессии, а её
  // нет у гостя вне Telegram. Без него шторка не откроется вовсе — неактивная
  // кнопка обещала бы действие, которого нет.
  const canVote = userId !== null && voteBalance !== null;

  /** Своя запись — то же действие, только цель уже известна. */
  const ownVoteTarget = canVote ? own.project : null;

  const openVote = (project: ProjectListItem, rank: number | null) => {
    setVoteError(null);
    setVoteTarget({ project, rank });
  };

  const confirmVote = async (amount: number) => {
    if (!voteTarget) return;
    const initData = getPlatform().getInitData();
    if (!initData) return;

    try {
      const result = await castVotes({ initData, projectId: voteTarget.project.id, amount });
      // Баланс берётся из ответа, а не вычитается на клиенте: считала его та же
      // хранимка, что и списала голоса.
      applyVoteBalance(result.balanceAfter);
      setVoteTarget(null);
      refreshBoard();
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : String(error));
    }
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
        onOpenDetails={(item) => nav.push({ name: 'project', id: item.id, segment: 'free' })}
        onOpenProject={(item) => {
          const initData = getPlatform().getInitData();
          // Fire-and-forget: счётчик не должен задерживать переход по ссылке.
          // Он же засчитывает задание visit — на сервере, одной транзакцией.
          if (initData) registerClick({ initData, projectId: item.id }).catch(() => {});
          getPlatform().openLink(item.url);
        }}
        // Своя запись уже есть — предлагать вторую бессмысленно, она всё
        // равно упадёт в 23505 (код-ревью PR #12).
        onAddProject={userId && !own.project ? () => setAddOpen(true) : undefined}
        today={{ scope, onScopeChange: setScope, items: today.items, loading: today.loading }}
        // Голоса не пересчитываются в валюту и не сжимаются: своя единица, и
        // числа в бесплатном топе такие, что «1,2K» читается хуже точного.
        activity={toVoteActivityItems(activity.events)}
        onVote={canVote ? (item, rank) => openVote(item, rank) : undefined}
        onAction={ownVoteTarget ? () => openVote(ownVoteTarget, own.rank ?? null) : undefined}
      />

      <AddProjectSheet
        open={addOpen}
        currency={currency}
        onClose={() => setAddOpen(false)}
        categories={categories.categories}
        taken={{ free: Boolean(own.project) }}
        onSubmit={async ({ url, categoryId }) => {
          const initData = getPlatform().getInitData();
          if (!initData) throw new Error('Открой мини-апп в Telegram, чтобы добавить проект');
          await createProject({ initData, categoryId, url });
          setAddOpen(false);
          refreshBoard();
        }}
      />

      <VoteSheet
        open={voteTarget !== null}
        project={voteTarget?.project ?? null}
        rank={voteTarget?.rank ?? null}
        balance={voteBalance ?? 0}
        error={voteError}
        onClose={() => setVoteTarget(null)}
        onConfirm={confirmVote}
      />
    </>
  );
}
