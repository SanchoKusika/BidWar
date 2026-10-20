import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { SignInCard } from '@/shared/ui/SignInCard';
import { StatBlock } from '@/shared/ui/StatBlock';
import { TaskListItem, TaskListItemSkeleton } from '@/shared/ui/TaskListItem';
import { TASK_ICON, splitTasks, taskCopy, type TaskItem } from '@/entities/task';
import { useGuestSignIn } from '@/entities/user';
import { strings } from '@/shared/i18n/strings';
import { PageHeader } from './PageHeader';
import { HeaderAction } from './HeaderAction';
import { Gutter, ScreenBody, Section } from './ScreenLayout';
import styles from './TasksScreen.module.css';

const t = strings.tasks;

export interface TasksScreenProps {
  tasks: readonly TaskItem[];
  voteBalance: number | null;
  /** Показывать нечего и ответ в пути. Поверх прошлого списка не поднимается. */
  loading?: boolean;
  /** Запрос не удался, и показать при этом тоже нечего. */
  error?: boolean;
  onRetry?: () => void;
  /** Ответ на проверку задания: «ещё не подписан» или отказ функции. */
  notice?: string | null;
  /** The task whose check or claim is in flight — drawn as «checking». */
  busyTaskId?: number | null;
  /**
   * What a tap on the task does, or nothing: a row without an action is not
   * drawn as a button (a streak record grows by itself).
   */
  actionFor: (task: TaskItem) => (() => void) | undefined;
  onRules: () => void;
}

/**
 * Экран заданий (design/ui_kits/mini_app/Screens.jsx). Голоса — единственная
 * валюта здесь: ни одной денежной строки на экране быть не должно, иначе
 * бесплатный топ перестаёт читаться как бесплатный.
 */
export function TasksScreen({
  tasks,
  voteBalance,
  loading = false,
  error = false,
  onRetry,
  notice,
  busyTaskId = null,
  actionFor,
  onRules,
}: TasksScreenProps) {
  const { daily, goal, once } = splitTasks(tasks);
  const shown = daily.length + goal.length + once.length;
  const row = { busyTaskId, actionFor };
  // Tasks pay an account. Without one the board has no answer at all, and
  // «that's all for today» in its place would be a claim about nothing.
  const signIn = useGuestSignIn();

  return (
    <>
      <PageHeader
        segment="free"
        title={t.title}
        meta={t.meta}
        right={
          // Место под число держится, пока ответ в пути. Но `null` бывает и
          // конечным состоянием — у гостя без initData и после неудачной
          // авторизации числа не будет никогда, и вечно мерцающая заглушка
          // врала бы про загрузку, которой нет.
          voteBalance !== null ? (
            <StatBlock segment="free" value={voteBalance} label={t.yourVotes} showUnit={false} />
          ) : loading ? (
            <StatBlock segment="free" value={0} label={t.yourVotes} showUnit={false} loading />
          ) : undefined
        }
        action={<HeaderAction icon="gavel" label={strings.rules.chip} onClick={onRules} />}
      />

      <ScreenBody>
        {notice && (
          <Gutter>
            <p className={styles.notice}>{notice}</p>
          </Gutter>
        )}

        {daily.length > 0 && <Group label={t.daily} items={daily} {...row} />}
        {goal.length > 0 && <Group label={t.goals} items={goal} {...row} />}
        {once.length > 0 && <Group label={t.oneTime} items={once} {...row} />}

        {shown === 0 && loading && (
          // The board's own shape: four daily rows, three goals, two one-time.
          // Project cards stood here before — twice as tall as a task row, so
          // the list shrank under the finger when it arrived.
          <>
            <SkeletonGroup label={t.daily} rows={4} />
            <SkeletonGroup label={t.goals} rows={3} />
            <SkeletonGroup label={t.oneTime} rows={2} />
          </>
        )}

        {signIn && (
          <Gutter>
            <SignInCard onSignIn={signIn} note={strings.web.signInTasks} />
          </Gutter>
        )}

        {!signIn && shown === 0 && !loading && (
          <Gutter>
            {/* Три разных пустых экрана, а не один: «ещё грузится», «не
                загрузилось» и «всё сделано» — разные новости, и подменять
                одну другой значит врать про состояние. */}
            {error ? (
              <EmptyState
                icon="triangle-alert"
                segment="free"
                title={t.errorTitle}
                description={t.errorNote}
                actionLabel={onRetry ? t.retry : undefined}
                onAction={onRetry}
                compact
              />
            ) : (
              <EmptyState
                icon="clock"
                segment="free"
                title={t.emptyTitle}
                description={t.emptyNote}
                compact
              />
            )}
          </Gutter>
        )}
      </ScreenBody>
    </>
  );
}

function SkeletonGroup({ label, rows }: { label: string; rows: number }) {
  return (
    <Section>
      <SectionLabel>{label}</SectionLabel>
      <Gutter className={styles.list}>
        {Array.from({ length: rows }, (_, i) => (
          <TaskListItemSkeleton key={i} />
        ))}
      </Gutter>
    </Section>
  );
}

function Group({
  label,
  items,
  busyTaskId,
  actionFor,
}: {
  label: string;
  items: TaskItem[];
  busyTaskId: number | null;
  actionFor: TasksScreenProps['actionFor'];
}) {
  return (
    <Section>
      <SectionLabel>{label}</SectionLabel>
      <Gutter className={styles.list}>
        {items.map((task) => {
          // Подписи — на языке интерфейса, из базы берётся только награда и
          // состояние: список заданий фиксированный, и его строки не текст
          // пользователя, а часть продукта.
          const copy = taskCopy(task);
          return (
            <TaskListItem
              key={task.id}
              title={copy.title}
              subtitle={copy.note ?? undefined}
              reward={task.rewardVotes}
              icon={TASK_ICON[task.type]}
              state={task.id === busyTaskId ? 'pending' : task.state}
              progress={task.progress}
              onPress={actionFor(task)}
            />
          );
        })}
      </Gutter>
    </Section>
  );
}
