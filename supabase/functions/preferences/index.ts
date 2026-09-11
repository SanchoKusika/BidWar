import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';

/** Настройки, которые обязаны жить на сервере: по ним решает бот, а не экран. */
interface Preferences {
  notifyAttacked: boolean;
  notifyRankLost: boolean;
  notifyVotes: boolean;
  notifyReferral: boolean;
  /** null — человек не выбирал язык руками, бот берёт язык оболочки. */
  language: string | null;
}

interface PreferencesRequest {
  initData?: string;
  /** Без него — просто чтение. Пустой объект — тоже чтение, и это не ошибка. */
  patch?: Partial<Preferences>;
}

const LANGUAGES = ['RU', 'UZ', 'EN'];

const COLUMNS = 'notify_attacked, notify_rank_lost, notify_votes, notify_referral, language';

type Row = {
  notify_attacked: boolean;
  notify_rank_lost: boolean;
  notify_votes: boolean;
  notify_referral: boolean;
  language: string | null;
};

const toPreferences = (row: Row): Preferences => ({
  notifyAttacked: row.notify_attacked,
  notifyRankLost: row.notify_rank_lost,
  notifyVotes: row.notify_votes,
  notifyReferral: row.notify_referral,
  language: row.language,
});

/** Только известные поля и только известные значения: тело запроса — чужой ввод. */
function toColumns(patch: Partial<Preferences>): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  const flags = {
    notifyAttacked: 'notify_attacked',
    notifyRankLost: 'notify_rank_lost',
    notifyVotes: 'notify_votes',
    notifyReferral: 'notify_referral',
  } as const;

  for (const [field, column] of Object.entries(flags)) {
    const value = patch[field as keyof typeof flags];
    if (typeof value === 'boolean') update[column] = value;
  }

  if (patch.language === null) update.language = null;
  else if (typeof patch.language === 'string' && LANGUAGES.includes(patch.language)) {
    update.language = patch.language;
  }

  return update;
}

/**
 * Чтение и запись настроек, от которых зависит бот: три вида уведомлений и
 * язык. Остальные настройки (тема, валюта показа, компактные суммы, вибрация)
 * сюда не ходят и не должны — они про устройство, и сервер о них ничего не
 * знает.
 *
 * Отдельная функция, а не поля в ответе `auth`: настройки читаются при открытии
 * одного экрана из четырёх, а `auth` зовётся на каждом старте.
 */
serve('preferences', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<PreferencesRequest>();
  if (!body.initData) throw badRequest('initData обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const db = getAdminClient();

  const update = body.patch ? toColumns(body.patch) : {};

  // Ответ один и тот же у чтения и записи: экран рисует то, что в базе, а не то,
  // что он отправил. Иначе отброшенное сервером значение осталось бы на экране.
  const query =
    Object.keys(update).length > 0
      ? db.from('users').update(update).eq('id', userId).select(COLUMNS).single()
      : db.from('users').select(COLUMNS).eq('id', userId).single();

  const { data, error } = await query;
  if (error) throw error;

  ctx.log('preferences', { userId, changed: Object.keys(update) });

  return toPreferences(data as Row);
});
