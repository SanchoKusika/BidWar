import type { IconName } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import type { TaskGroup, TaskItem, TaskType } from './types';

export const TASK_ICON: Record<TaskType, IconName> = {
  visit: 'external-link',
  subscribe: 'send',
  referral: 'user-plus',
  daily_checkin: 'calendar-check',
  daily_votes: 'vote',
  daily_visits: 'list-checks',
  daily_scout: 'sparkles',
  daily_quest: 'target',
  ladder_streak: 'flame',
  ladder_votes: 'trophy',
  ladder_backed: 'heart-handshake',
  ladder_visits: 'mouse-pointer-click',
  ladder_subscriptions: 'send',
  referral_streak: 'users',
  add_project: 'folder-plus',
  bot_dm: 'bot',
  boost: 'rocket',
  site_login: 'globe',
  premium: 'crown',
};

/**
 * The section comes from the server (`group`). A server older than the daily
 * tasks sends none: its three types keep their old places, and a type this
 * build has no icon for is hidden rather than drawn without one.
 */
const LEGACY_GROUP: Partial<Record<TaskType, TaskGroup>> = {
  visit: 'daily',
  referral: 'once',
  subscribe: 'once',
};

function groupOf(task: TaskItem): TaskGroup | null {
  if (!(task.type in TASK_ICON)) return null;
  return task.group ?? LEGACY_GROUP[task.type] ?? null;
}

export function splitTasks(tasks: readonly TaskItem[]): Record<TaskGroup, TaskItem[]> {
  const groups: Record<TaskGroup, TaskItem[]> = { daily: [], goal: [], once: [] };
  for (const task of tasks) {
    const group = groupOf(task);
    if (group) groups[group].push(task);
  }
  return groups;
}

/**
 * Подписи задания на языке интерфейса.
 *
 * В базе они лежат по-английски, и это не пользовательский текст: список
 * заданий у платформы фиксированный, строки засеяны миграцией. Поэтому экран
 * печатает свои — по типу задания, — а из ответа берёт только награду,
 * состояние и прогресс.
 *
 * Исключение — канал в подписи `subscribe`: юзернейм это имя собственное, он не
 * переводится. Берётся из ссылки задания, а если ссылка не телеграмная (такого
 * быть не должно, но задание живёт в базе и могло приехать любым) — остаётся
 * название из базы, потому что подпись без имени канала бесполезна.
 */
export function taskCopy(task: TaskItem): { title: string; note: string | null } {
  const t = strings.tasks;
  const goal = task.progress?.total ?? 1;

  switch (task.type) {
    case 'visit':
      return { title: t.visitTitle, note: t.visitNote };
    case 'referral':
      return { title: t.referralTitle(goal), note: t.referralNote };
    case 'subscribe': {
      const handle = channelHandle(task.targetUrl);
      return { title: handle ? t.subscribeTitle(handle) : task.title, note: t.subscribeNote };
    }
    case 'daily_checkin':
      return { title: t.checkinTitle, note: t.checkinNote };
    case 'daily_visits':
      return { title: t.dailyVisitsTitle, note: t.dailyVisitsNote };
    case 'daily_scout':
      return { title: t.scoutTitle, note: t.scoutNote };
    case 'daily_votes':
      return { title: t.dailyVotesTitle(goal), note: t.dailyVotesNote };
    case 'daily_quest':
      return task.quest === 'categories'
        ? { title: t.questCategoriesTitle(goal), note: t.questCategoriesNote }
        : { title: t.questBackedTitle(goal), note: t.questBackedNote };
    case 'referral_streak':
      return { title: t.friendStreakTitle(goal), note: t.friendStreakNote };
    case 'ladder_streak':
      return { title: t.streakLadderTitle(goal), note: t.streakLadderNote };
    case 'ladder_votes':
      return { title: t.votesLadderTitle(goal), note: t.votesLadderNote };
    case 'ladder_backed':
      return { title: t.backedLadderTitle(goal), note: t.backedLadderNote };
    case 'ladder_visits':
      return { title: t.visitsLadderTitle(goal), note: t.visitsLadderNote };
    case 'ladder_subscriptions':
      return { title: t.subscriptionsLadderTitle(goal), note: t.subscriptionsLadderNote };
    case 'add_project':
      return { title: t.addProjectTitle, note: t.addProjectNote };
    case 'bot_dm':
      return { title: t.botDmTitle, note: t.botDmNote };
    case 'boost':
      return { title: t.boostTitle, note: t.boostNote };
    case 'site_login':
      return { title: t.siteLoginTitle, note: t.siteLoginNote };
    case 'premium':
      return { title: t.premiumTitle, note: t.premiumNote };
  }
}

/** «@channel» из ссылки вида t.me/channel. Ничего больше из неё не нужно. */
function channelHandle(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/^(www\.)?t\.me$/i.test(parsed.hostname)) return null;
    const name = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
    return /^[A-Za-z0-9_]{5,32}$/.test(name) ? `@${name}` : null;
  } catch {
    return null;
  }
}

/**
 * How many tasks can be done now — the number on the tab bar. `pending` does
 * not count: the check is under way, there is nothing to do there. A goal
 * counts only once it is ready: a ladder is «available» for weeks, and a badge
 * that never drops below five stops meaning anything.
 */
export function availableCount(tasks: readonly TaskItem[]): number {
  return tasks.filter((task) => {
    const group = groupOf(task);
    if (group === null) return false;
    if (task.state === 'ready') return true;
    return task.state === 'available' && group !== 'goal';
  }).length;
}
