import { useState } from 'react';
import { useSession } from '@/entities/user';
import { checkSubscription } from '@/features/subscribe';
import { claimTask } from '@/features/claim-task';
import { getPlatform } from '@/shared/platform';
import { haptic } from '@/shared/lib/haptic';
import { strings } from '@/shared/i18n/strings';
import { brand } from '@/shared/content';
import { TasksScreen } from '@/widgets/mobile/TasksScreen';
import { DesktopTasks } from '@/widgets/desktop/Tasks';
import { useLayout } from '@/shared/lib/layout';
import type { TaskItem } from '@/entities/task';
import type { Navigation } from '@/app/navigation';
import { useTaskBoard } from '../model';

export interface TasksPageProps {
  nav: Navigation;
}

/**
 * Tasks on live data.
 *
 * The balance comes from the `tasks` answer, not the session: the session
 * loads once at start, while votes move during use — a task of your own,
 * someone's vote for your project, a friend's reward. Until the answer comes
 * the session balance stands in: stale but real, where a zero over earned
 * votes would be false.
 *
 * A tap counts nothing by itself except on `ready`: the condition is met and
 * the tap claims the reward (`claim-task`, checked by the server). Otherwise
 * the tap leads to where the task is done:
 *
 * - visits — to the Paid Top, where the links are;
 * - votes and projects — to the Free Top;
 * - the newcomer task — to the page of the newest project not opened yet;
 * - friends — to the link in the profile;
 * - `subscribe` is checked by the server (`getChatMember` is the bot's, not
 *   the mini app's): not subscribed opens the channel;
 * - the bot and the boost are checked by the server too, asking Telegram; a
 *   refusal opens the bot or the boost page.
 *
 * A task a tap cannot do (the streak record grows by itself) does not pose as
 * a button: it has no action, and the row is not pressable.
 */
export function TasksPage({ nav }: TasksPageProps) {
  const session = useSession();
  const board = useTaskBoard();
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const Screen = useLayout() === 'desktop' ? DesktopTasks : TasksScreen;
  const t = strings.tasks;

  const verifySubscription = async (task: TaskItem) => {
    const initData = getPlatform().getInitData();
    if (initData === null || busyId !== null) return;

    setBusyId(task.id);
    setNotice(null);
    try {
      const result = await checkSubscription({ initData, taskId: task.id });
      if (result.subscribed) {
        // Число приходит из хранимки, которая его и изменила. Складывать
        // `granted` с балансом, который держит экран, неверно дважды: тот может
        // отставать от голоса с вкладки Free, а доплаты за друга в нём нет.
        session.applyVoteBalance(result.balanceAfter);
        // Отклик только когда задание действительно засчиталось: на «проверил и
        // не подписан» его нет — там ничего не произошло.
        if (result.granted > 0) haptic('success');
        board.refresh();
        return;
      }
      // Не подписан — открываем канал, а не отчитываем: человек нажал именно
      // затем, чтобы задание выполнить. Отклик при этом такой же, как у
      // непрошедшего платежа: это отказ, и молчать о нём не за что.
      haptic('error');
      setNotice(t.notSubscribed);
      if (task.targetUrl) getPlatform().openLink(task.targetUrl);
    } catch (error) {
      haptic('error');
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  };

  const claim = async (task: TaskItem) => {
    const initData = getPlatform().getInitData();
    if (initData === null || busyId !== null) return;

    setBusyId(task.id);
    setNotice(null);
    try {
      const result = await claimTask({ initData, taskId: task.id });
      // The true balance either way: a refusal reports it too.
      session.applyVoteBalance(result.balanceAfter);

      if (result.claimed) {
        haptic('success');
      } else {
        // Like an unpaid subscription: the tap meant «do it», so the place
        // where it gets done opens rather than a scolding.
        haptic('error');
        if (result.reason === 'bot_unreachable') {
          setNotice(t.botUnreachable);
          getPlatform().openLink(brand.botLink);
        } else if (result.reason === 'not_boosted') {
          setNotice(t.notBoosted);
          if (task.targetUrl) getPlatform().openLink(task.targetUrl);
        } else if (result.reason === 'done') {
          // Counted already, from another tab or device: the redrawn list says so.
        } else {
          // The card said «claim» on numbers that moved since (a new day).
          setNotice(t.notReady);
        }
      }
      board.refresh();
    } catch (error) {
      haptic('error');
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  };

  const actionFor = (task: TaskItem): (() => void) | undefined => {
    if (task.state === 'ready') return () => void claim(task);
    if (task.state !== 'available') return undefined;

    switch (task.type) {
      case 'visit':
      case 'daily_visits':
      case 'ladder_visits':
        return () => nav.setTab('paid');
      case 'daily_scout': {
        const id = task.targetProjectId;
        return id === null
          ? () => nav.setTab('paid')
          : () => nav.push({ name: 'project', id, segment: 'paid' });
      }
      case 'daily_votes':
      case 'ladder_votes':
      case 'ladder_backed':
      case 'add_project':
        return () => nav.setTab('free');
      case 'referral':
      case 'referral_streak':
        return () => nav.requestProfileFocus('referral');
      case 'subscribe':
        return () => void verifySubscription(task);
      case 'bot_dm':
      case 'boost':
        return () => void claim(task);
      case 'site_login':
        return () => getPlatform().openLink(`${brand.siteLink}/tasks`);
      default:
        // The streak record grows by the daily bonus itself.
        return undefined;
    }
  };

  return (
    <Screen
      tasks={board.data?.tasks ?? []}
      voteBalance={board.data?.voteBalance ?? session.voteBalance}
      loading={board.loading}
      error={board.error}
      notice={notice}
      busyTaskId={busyId}
      onRetry={board.refresh}
      actionFor={actionFor}
      onRules={() => nav.push({ name: 'rules', anchor: 'votes' })}
    />
  );
}
