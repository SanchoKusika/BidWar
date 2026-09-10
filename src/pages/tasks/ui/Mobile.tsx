import { useState } from 'react';
import { useSession } from '@/entities/user';
import { checkSubscription } from '@/features/subscribe';
import { getPlatform } from '@/shared/platform';
import { strings } from '@/shared/i18n/strings';
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
 * Тап по заданию сам ничего не «засчитывает»:
 *
 * - `visit` закрывается переходом по ссылке проекта, его считает `click`, —
 *   поэтому кнопка ведёт туда, где такие ссылки есть;
 * - `referral` закрывается действием приглашённого, а не своим, — поэтому
 *   кнопка ведёт к ссылке в профиле;
 * - `subscribe` проверяется на сервере (`getChatMember` доступен боту, а не
 *   мини-аппу): не подписан — открываем канал, подписан — задание закрывается.
 */
export function TasksPage({ nav }: TasksPageProps) {
  const session = useSession();
  const board = useTaskBoard();
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const verifySubscription = async (task: TaskItem) => {
    const initData = getPlatform().getInitData();
    if (initData === null || task.targetProjectId === null || checking) return;

    setChecking(true);
    setNotice(null);
    try {
      const result = await checkSubscription({ initData, projectId: task.targetProjectId });
      if (result.subscribed) {
        session.applyVoteBalance((board.data?.voteBalance ?? 0) + result.granted);
        board.refresh();
        return;
      }
      // Не подписан — открываем канал, а не отчитываем: человек нажал именно
      // затем, чтобы задание выполнить.
      setNotice(strings.tasks.notSubscribed);
      if (task.targetUrl) getPlatform().openLink(task.targetUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };

  const onTask = (task: TaskItem) => {
    if (task.type === 'visit') {
      nav.setTab('paid');
      return;
    }
    if (task.type === 'referral') {
      nav.setTab('profile');
      return;
    }
    void verifySubscription(task);
  };

  return (
    <TasksScreen
      tasks={board.data?.tasks ?? []}
      voteBalance={board.data?.voteBalance ?? session.voteBalance}
      loading={board.loading}
      error={board.error}
      notice={notice}
      onRetry={board.refresh}
      onTask={onTask}
      onRules={() => nav.push({ name: 'rules', anchor: 'votes' })}
    />
  );
}
