import type { TaskItem } from './types';

/**
 * Временные задания для витрины.
 *
 * Таблицы tasks и task_completions в схеме есть, но строк в них не заведено и
 * API к ним нет — задания появятся в Срезе 1.7. До тех пор экран рисуется на
 * этих данных; см. PREVIEW.tasks в shared/config/preview.ts.
 *
 * Тексты — из дизайн-кита (design/ui_kits/mini_app/data.js), но разложены по
 * реальным полям TaskItem, чтобы подключение свелось к замене источника.
 */
export const TASK_FIXTURES: readonly TaskItem[] = [
  {
    id: 1,
    type: 'subscribe',
    title: 'Subscribe to @bidwar',
    description: 'Stay subscribed 3 days to keep the reward',
    rewardVotes: 25,
    targetProjectId: null,
    state: 'available',
  },
  {
    id: 2,
    type: 'referral',
    title: 'Invite friends',
    description: 'Each friend who opens the app counts',
    rewardVotes: 150,
    targetProjectId: null,
    state: 'available',
    progress: { current: 1, total: 3 },
  },
  {
    id: 3,
    type: 'visit',
    title: 'Visit a project a day',
    description: 'One link is enough — the click is counted once per day',
    rewardVotes: 10,
    targetProjectId: null,
    state: 'available',
  },
  {
    id: 4,
    type: 'subscribe',
    title: 'Verify your channel',
    description: 'We check the admin rights',
    rewardVotes: 100,
    targetProjectId: null,
    state: 'pending',
  },
];
