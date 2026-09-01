import { getPlatform } from '@/shared/platform';
import { useSession } from '@/entities/user';
import { useCategoryStats } from '@/entities/category';
import { registerClick, type ShowcaseType } from '@/entities/project';
import { SkeletonFeed } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PREVIEW } from '@/shared/config/preview';
import { useSettings } from '@/shared/settings';
import { strings } from '@/shared/i18n/strings';
import { ProjectScreen, type ActivityEntry } from '@/widgets/mobile/ProjectScreen';
import { useProject } from '../model';
import styles from './Mobile.module.css';

export interface ProjectPageProps {
  id: number;
  segment: ShowcaseType;
  onBack: () => void;
  onRules: (anchor?: string) => void;
  /** Уводит на вкладку Paid — там живёт шторка Raise и сама оплата. */
  onGoPaid: () => void;
}

/** Лента изменений ставки: транзакции пока никто не пишет (PREVIEW.activityFeed). */
const ACTIVITY_FIXTURES: readonly ActivityEntry[] = [
  { label: 'Raise', when: 'Today 12:40', amount: '40 000', up: true },
  { label: 'Attacked by Toshkent Auto', when: 'Yesterday 21:15', amount: '20 000', up: false },
  { label: 'Raise', when: '23 Aug', amount: '60 000', up: true },
];

/** Кто держит позицию: публичного хендла в users нет (PREVIEW.ownerHandle). */
const OWNER_FIXTURE = { buyer: '@mebelsavdo', since: 'Aug 2026' };

export function ProjectPage({ id, segment, onBack, onRules, onGoPaid }: ProjectPageProps) {
  const { userId } = useSession();
  const { currency, compactAmounts } = useSettings();
  const categories = useCategoryStats(segment);
  const { project, rank, otherEntry, otherRank, status } = useProject(id, segment);

  if (status === 'loading') {
    return (
      <div className={styles.pad}>
        <SkeletonFeed rows={3} />
      </div>
    );
  }

  if (status === 'error' || !project) {
    return (
      <div className={styles.pad}>
        <EmptyState
          icon="triangle-alert"
          title={strings.showcase.errorTitle}
          description={strings.showcase.errorNote}
          actionLabel={strings.common.back}
          onAction={onBack}
        />
      </div>
    );
  }

  const category = categories.categories.find((c) => c.categoryId === project.categoryId);

  return (
    <ProjectScreen
      project={project}
      segment={project.type}
      rank={rank}
      categoryTitle={category?.title ?? null}
      isOwn={userId !== null && project.userId === userId}
      currency={currency}
      compactAmounts={compactAmounts}
      owner={PREVIEW.ownerHandle ? OWNER_FIXTURE : undefined}
      activity={PREVIEW.activityFeed ? ACTIVITY_FIXTURES : undefined}
      otherEntry={otherEntry}
      otherRank={otherRank}
      otherIsOwn={userId !== null && otherEntry?.userId === userId}
      onBack={onBack}
      onOpenLink={() => {
        const initData = getPlatform().getInitData();
        // Счётчик не должен задерживать переход — отправляем и не ждём.
        if (initData) registerClick({ initData, projectId: project.id }).catch(() => {});
        getPlatform().openLink(project.url);
      }}
      onRaise={onGoPaid}
      onAttack={() => {}}
      onVote={() => {}}
      onOpenOther={() => {}}
      onRules={() => onRules(project.type === 'paid' ? 'attacks' : 'votes')}
    />
  );
}
