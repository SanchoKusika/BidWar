import { getPlatform } from '@/shared/platform';
import { useGuestSignIn, useSession } from '@/entities/user';
import { categoryTitle, useCategoryStats } from '@/entities/category';
import {
  registerClick,
  useMovement24h,
  type ProjectListItem,
  type ShowcaseType,
} from '@/entities/project';
import { useProjectActivity } from '@/entities/activity';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PREVIEW } from '@/shared/config/preview';
import { useSettings } from '@/shared/settings';
import { formatMoney, formatReceiptDate } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import {
  ProjectScreen,
  ProjectScreenSkeleton,
  type ActivityEntry,
} from '@/widgets/mobile/ProjectScreen';
import { DesktopProject, DesktopProjectSkeleton } from '@/widgets/desktop/Project';
import { useLayout } from '@/shared/lib/layout';
import { useMyContribution, useProject } from '../model';
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
  /** Goes to the Free tab and asks it to open the vote sheet for this project. */
  onVote: (target: ProjectListItem, rank: number | null) => void;
  /** Открыть страницу другого проекта — вторую запись того же аккаунта. */
  onOpenProject: (id: number, segment: ShowcaseType) => void;
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
  onVote,
  onOpenProject,
}: ProjectPageProps) {
  const { userId } = useSession();
  // Raising, attacking and voting need an account: on the site a viewer
  // without one is asked to sign in, not sent to a sheet that cannot pay.
  const signIn = useGuestSignIn();
  const { compactAmounts } = useSettings();
  const categories = useCategoryStats(segment);
  const { project, rank, otherEntry, otherRank, status } = useProject(id, segment);
  // Хук стоит до ранних возвратов ниже и потому берёт id из пропа, а не из
  // загруженного проекта: порядок хуков обязан быть одинаковым на каждый рендер.
  const events = useProjectActivity(id);
  // Day movement exists for the paid top only (paid_movement_24h).
  const movement = useMovement24h(segment === 'paid');
  const contribution = useMyContribution(userId, id);
  const desktop = useLayout() === 'desktop';
  const Screen = desktop ? DesktopProject : ProjectScreen;

  if (status === 'loading') {
    if (desktop) return <DesktopProjectSkeleton segment={segment} onBack={onBack} />;
    return (
      <ProjectScreenSkeleton
        segment={segment}
        onBack={onBack}
        onRules={() => onRules(segment === 'paid' ? 'attacks' : 'votes')}
      />
    );
  }

  if (status === 'missing' || status === 'error' || !project) {
    // A shared link to a project that is gone says so — «check the
    // connection» sent people after a problem they did not have.
    const missing = status === 'missing';
    return (
      <div className={styles.pad}>
        <EmptyState
          icon={missing ? 'search-x' : 'triangle-alert'}
          title={missing ? strings.project.missingTitle : strings.showcase.errorTitle}
          description={missing ? strings.project.missingNote : strings.showcase.errorNote}
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
    id: event.id,
    label:
      event.type === 'raise'
        ? strings.project.activityRaise
        : event.type === 'attack_in'
          ? strings.project.activityAttackIn(event.targetName ?? '—')
          : strings.project.activityAttackOut,
    when: formatReceiptDate(event.createdAt),
    amount: formatMoney(event.amount, { compact: compactAmounts }),
    up: event.type !== 'attack_out',
  }));

  return (
    <Screen
      project={project}
      segment={project.type}
      rank={rank}
      categoryTitle={category ? categoryTitle(category.slug, category.title) : null}
      isOwn={userId !== null && project.userId === userId}
      compactAmounts={compactAmounts}
      owner={PREVIEW.ownerHandle ? OWNER_FIXTURE : undefined}
      activity={activity}
      otherEntry={otherEntry}
      otherRank={otherRank}
      otherIsOwn={userId !== null && otherEntry?.userId === userId}
      valueDelta={movement.get(project.id)?.amountDelta}
      rankDelta={(() => {
        const past = movement.get(project.id)?.rank;
        return past !== undefined && rank !== null ? past - rank : undefined;
      })()}
      contribution={contribution}
      onBack={onBack}
      onOpenLink={() => {
        const initData = getPlatform().getInitData();
        // Счётчик не должен задерживать переход — отправляем и не ждём.
        if (initData) registerClick({ initData, projectId: project.id }).catch(() => {});
        getPlatform().openLink(project.url);
      }}
      // Свой проект поднимают на вкладке Paid обычным Raise; чужой — донатом,
      // и цель надо донести до вкладки, иначе шторка не знает, кого поднимать.
      onRaise={
        signIn ??
        (() => (userId !== null && project.userId === userId ? onGoPaid() : onBoost(project, rank)))
      }
      onAttack={signIn ?? (() => onAttack(project, rank))}
      onVote={signIn ?? (() => onVote(project, rank))}
      // Вторая запись того же аккаунта — такой же проект со своей страницей.
      // Оба действия карточки были пустыми функциями: «Подробнее» никуда не
      // вело, тап по телу не открывал ссылку — то есть блок выглядел рабочим и
      // не делал ничего.
      onOpenOther={() => otherEntry && onOpenProject(otherEntry.id, otherEntry.type)}
      onOpenOtherLink={() => {
        if (!otherEntry) return;
        const initData = getPlatform().getInitData();
        if (initData) registerClick({ initData, projectId: otherEntry.id }).catch(() => {});
        getPlatform().openLink(otherEntry.url);
      }}
      onRules={() => onRules(project.type === 'paid' ? 'attacks' : 'votes')}
    />
  );
}
