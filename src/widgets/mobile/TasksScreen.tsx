import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { StatBlock } from '@/shared/ui/StatBlock';
import { TaskListItem } from '@/shared/ui/TaskListItem';
import { TASK_ICON, splitTasks, type TaskItem } from '@/entities/task';
import { strings } from '@/shared/i18n/strings';
import { PageHeader } from './PageHeader';
import { HeaderAction } from './HeaderAction';
import { Gutter, ScreenBody, Section } from './ScreenLayout';
import styles from './TasksScreen.module.css';

const t = strings.tasks;

export interface TasksScreenProps {
  tasks: readonly TaskItem[];
  voteBalance: number | null;
  onTask: (task: TaskItem) => void;
  onRules: () => void;
}

/**
 * Экран заданий (design/ui_kits/mini_app/Screens.jsx). Голоса — единственная
 * валюта здесь: ни одной денежной строки на экране быть не должно, иначе
 * бесплатный топ перестаёт читаться как бесплатный.
 */
export function TasksScreen({ tasks, voteBalance, onTask, onRules }: TasksScreenProps) {
  const { daily, oneTime } = splitTasks(tasks);

  return (
    <>
      <PageHeader
        segment="free"
        title={t.title}
        meta={t.meta}
        right={
          voteBalance !== null ? (
            <StatBlock segment="free" value={voteBalance} label={t.yourVotes} />
          ) : undefined
        }
        action={<HeaderAction icon="gavel" label={strings.rules.chip} onClick={onRules} />}
      />

      <ScreenBody>
        {daily.length > 0 && <Group label={t.daily} items={daily} onTask={onTask} />}
        {oneTime.length > 0 && <Group label={t.oneTime} items={oneTime} onTask={onTask} />}

        <Gutter>
          <EmptyState
            icon="clock"
            segment="free"
            title={t.emptyTitle}
            description={t.emptyNote}
            compact
          />
        </Gutter>
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
        {items.map((task) => (
          <TaskListItem
            key={task.id}
            title={task.title}
            subtitle={task.description ?? undefined}
            reward={task.rewardVotes}
            icon={TASK_ICON[task.type]}
            state={task.state}
            progress={task.progress}
            onPress={() => onTask(task)}
          />
        ))}
      </Gutter>
    </Section>
  );
}
