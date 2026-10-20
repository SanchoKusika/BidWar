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
 * Задания на настоящих данных (Срез 1.7).
 *
 * Баланс берётся из ответа `tasks`, а не из сессии: сессия грузится один раз
 * при старте мини-аппа, а голоса меняются прямо во время работы — своим
 * заданием, чужим голосом за твой проект, наградой за приглашённого. Пока
 * ответа нет, показывается балансом сессии: он устаревший, но настоящий, а
 * ноль поверх заработанных голосов был бы неправдой.
 *
 * Тап по заданию сам ничего не «засчитывает», кроме `ready` — там условие уже
 * выполнено, и нажатие забирает награду (`claim-task`, проверяет сервер).
 * В остальных случаях тап ведёт туда, где задание делается:
 *
 * - переходы и задание дня по категориям — на платный топ, где ссылки;
 * - голоса и проекты — на бесплатный топ;
 * - новичок витрины — на страницу самого нового неоткрытого проекта;
 * - друзья — к ссылке в профиле;
 * - `subscribe` проверяется на сервере (`getChatMember` доступен боту, а не
 *   мини-аппу): не подписан — открываем канал, подписан — задание закрывается;
 * - бот и буст тоже проверяет сервер, спрашивая Telegram; отказ открывает
 *   бота или страницу буста.
 *
 * Задание, которое тапом не сделать (рекорд серии растёт сам), кнопкой не
 * притворяется: у него нет действия, и строка не нажимается.
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
      case 'daily_quest':
        return () => nav.setTab(task.quest === 'categories' ? 'paid' : 'free');
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
        // The streak record and the channels ladder grow by other tasks.
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
