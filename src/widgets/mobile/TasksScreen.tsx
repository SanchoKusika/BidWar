import { EmptyState } from '@/shared/ui/EmptyState';
import { SkeletonFeed, SkeletonStat } from '@/shared/ui/Skeleton';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { StatBlock } from '@/shared/ui/StatBlock';
import { TaskListItem } from '@/shared/ui/TaskListItem';
import { TASK_ICON, splitTasks, taskCopy, type TaskItem } from '@/entities/task';
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
  onTask: (task: TaskItem) => void;
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
  onTask,
  onRules,
}: TasksScreenProps) {
  const { daily, oneTime } = splitTasks(tasks);

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
            <SkeletonStat />
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

        {daily.length > 0 && <Group label={t.daily} items={daily} onTask={onTask} />}
        {oneTime.length > 0 && <Group label={t.oneTime} items={oneTime} onTask={onTask} />}

        {tasks.length === 0 && (
          <Gutter>
            {/* Три разных пустых экрана, а не один: «ещё грузится», «не
                загрузилось» и «всё сделано» — разные новости, и подменять
                одну другой значит врать про состояние. */}
            {loading ? (
              <SkeletonFeed rows={4} />
            ) : error ? (
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

function Group({
  label,
  items,
  onTask,
}: {
  label: string;
  items: TaskItem[];
  onTask: (task: TaskItem) => void;
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
              state={task.state}
              progress={task.progress}
              onPress={() => onTask(task)}
            />
          );
        })}
      </Gutter>
    </Section>
  );
}
