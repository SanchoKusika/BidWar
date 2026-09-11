import type { IconName } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import type { TaskItem, TaskType } from './types';

export const TASK_ICON: Record<TaskType, IconName> = {
  visit: 'external-link',
  subscribe: 'send',
  referral: 'user-plus',
};

/**
 * Деление на «каждый день» и «один раз».
 *
 * В схеме признака периодичности нет вообще — есть только tasks.type. Заход в
 * проект повторяется, подписка и приглашение засчитываются один раз, поэтому
 * группа выводится из типа. Когда периодичность понадобится настраивать, это
 * должна быть колонка в tasks, а не догадка на клиенте.
 */
const DAILY: readonly TaskType[] = ['visit'];

export function isDaily(task: TaskItem): boolean {
  return DAILY.includes(task.type);
}

export function splitTasks(tasks: readonly TaskItem[]): {
  daily: TaskItem[];
  oneTime: TaskItem[];
} {
  return {
    daily: tasks.filter(isDaily),
    oneTime: tasks.filter((t) => !isDaily(t)),
  };
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

  if (task.type === 'visit') return { title: t.visitTitle, note: t.visitNote };
  if (task.type === 'referral') return { title: t.referralTitle, note: t.referralNote };

  const handle = channelHandle(task.targetUrl);
  return {
    title: handle ? t.subscribeTitle(handle) : task.title,
    note: t.subscribeNote,
  };
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
 * Сколько заданий сейчас можно выполнить — число на вкладке нижнего меню.
 * `pending` не считается: проверка уже идёт, делать там нечего.
 */
export function availableCount(tasks: readonly TaskItem[]): number {
  return tasks.filter((task) => task.state === 'available').length;
}
