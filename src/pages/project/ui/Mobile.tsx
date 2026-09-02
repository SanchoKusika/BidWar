import { getPlatform } from '@/shared/platform';
import { useSession } from '@/entities/user';
import { useCategoryStats } from '@/entities/category';
import { registerClick, type ProjectListItem, type ShowcaseType } from '@/entities/project';
import { useProjectActivity } from '@/entities/activity';
import { SkeletonFeed } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PREVIEW } from '@/shared/config/preview';
import { useSettings } from '@/shared/settings';
import { formatMoney, formatReceiptDate } from '@/shared/lib/format';
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
  /** Уводит на вкладку Paid и просит открыть Raise для ЧУЖОГО проекта (донат). */
  onBoost: (target: ProjectListItem, rank: number | null) => void;
  /** Уводит на вкладку Paid и просит открыть шторку атаки на этом проекте. */
  onAttack: (target: ProjectListItem, rank: number | null) => void;
}

/** Кто держит позицию: публичного хендла в users нет (PREVIEW.ownerHandle). */
const OWNER_FIXTURE = { buyer: '@mebelsavdo', since: 'Aug 2026' };

export function ProjectPage({
  id,
  segment,
  onBack,
  onRules,
  onGoPaid,
  onBoost,
  onAttack,
}: ProjectPageProps) {
  const { userId } = useSession();
  const { currency, compactAmounts } = useSettings();
  const categories = useCategoryStats(segment);
  const { project, rank, otherEntry, otherRank, status } = useProject(id, segment);
  // Хук стоит до ранних возвратов ниже и потому берёт id из пропа, а не из
  // загруженного проекта: порядок хуков обязан быть одинаковым на каждый рендер.
  const events = useProjectActivity(id);

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

  // Три типа событий леджера читаются с точки зрения ЭТОГО проекта: свой
  // Raise и прилетевшее зачисление за атаку поднимают ставку, полученная
  // атака её роняет. Позиции после события в строке нет — истории рангов мы
  // не храним (01 Механики), а сегодняшний ранг рядом со старой датой был бы
  // выдумкой.
  const activity: ActivityEntry[] = events.map((event) => ({
    label:
      event.type === 'raise'
        ? strings.project.activityRaise
        : event.type === 'attack_in'
          ? strings.project.activityAttackIn(event.targetName ?? '—')
          : strings.project.activityAttackOut,
    when: formatReceiptDate(event.createdAt),
    amount: formatMoney(event.amount, { currency, compact: compactAmounts }),
    up: event.type !== 'attack_out',
  }));

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
      activity={activity}
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
      // Свой проект поднимают на вкладке Paid обычным Raise; чужой — донатом,
      // и цель надо донести до вкладки, иначе шторка не знает, кого поднимать.
      onRaise={() =>
        userId !== null && project.userId === userId ? onGoPaid() : onBoost(project, rank)
      }
      onAttack={() => onAttack(project, rank)}
      onVote={() => {}}
      onOpenOther={() => {}}
      onRules={() => onRules(project.type === 'paid' ? 'attacks' : 'votes')}
    />
  );
}
