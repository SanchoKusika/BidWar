import { useSession } from '@/entities/user';
import { TasksScreen } from '@/widgets/mobile/TasksScreen';
import type { TaskItem } from '@/entities/task';
import type { Navigation } from '@/app/navigation';
import { useTaskBoard } from '../model';

export interface TasksPageProps {
  nav: Navigation;
}

/**
 * Задания на настоящих данных (Срез 1.7).
 *
 * Баланс берётся из ответа `tasks`, а не из сессии: сессия грузится один раз
 * при старте мини-аппа, а голоса меняются прямо во время работы — своим
 * заданием, чужим голосом за твой проект, наградой за приглашённого. Пока
 * ответа нет, показывается балансом сессии: он устаревший, но настоящий, а
 * ноль поверх заработанных голосов был бы неправдой.
 *
 * Тап по заданию никуда не «засчитывает»: `visit` закрывается самим переходом
 * по ссылке проекта (его считает `click`), поэтому кнопка ведёт туда, где
 * такие ссылки есть, а не имитирует выполнение.
 */
export function TasksPage({ nav }: TasksPageProps) {
  const session = useSession();
  const board = useTaskBoard();

  const onTask = (task: TaskItem) => {
    if (task.type === 'visit') {
      nav.setTab('paid');
      return;
    }
    if (task.type === 'referral') {
      nav.setTab('profile');
      return;
    }
    // subscribe привязан к каналу, а канал в системе — это платная запись.
    if (task.targetProjectId !== null) {
      nav.push({ name: 'project', id: task.targetProjectId, segment: 'paid' });
    }
  };

  return (
    <TasksScreen
      tasks={board.data?.tasks ?? []}
      voteBalance={board.data?.voteBalance ?? session.voteBalance}
      loading={board.loading}
      error={board.error}
      onRetry={board.refresh}
      onTask={onTask}
      onRules={() => nav.push({ name: 'rules', anchor: 'votes' })}
    />
  );
}
