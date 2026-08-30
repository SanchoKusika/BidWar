import { useSession } from '@/entities/user';
import { TASK_FIXTURES } from '@/entities/task';
import { TasksScreen } from '@/widgets/mobile/TasksScreen';
import type { Navigation } from '@/app/navigation';

export interface TasksPageProps {
  nav: Navigation;
}

/**
 * Задания. Пока витрина: строк в tasks нет и API к ним тоже
 * (PREVIEW.tasks) — выдача и зачёт наград приходят в Срезе 1.7.
 */
export function TasksPage({ nav }: TasksPageProps) {
  const { voteBalance } = useSession();

  return (
    <TasksScreen
      tasks={TASK_FIXTURES}
      voteBalance={voteBalance}
      onTask={() => {}}
      onRules={() => nav.push({ name: 'rules', anchor: 'votes' })}
    />
  );
}
