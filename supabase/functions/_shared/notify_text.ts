/**
 * Тексты сообщений бота.
 *
 * Свой словарь, а не `src/shared/i18n`: у функций другой рантайм и другой
 * корень, и тянуть туда клиентский модуль нельзя. Дублирование здесь
 * осознанное и маленькое — четыре сообщения против трёхсот строк интерфейса.
 *
 * Сообщение написано человеку и про него: «тебя атаковали», «ты больше не
 * первый». Раньше оно было в третьем лице («„Aleksandr K“ больше не первый») —
 * это читалось как новость о постороннем, хотя приходит в личный чат и
 * единственному, кого это касается.
 *
 * Язык берётся из `users.language`, а если человек не выбирал — из
 * `language_code` Telegram.
 */

import { channelUsername } from './bot_api.ts';

export type NotifyLocale = 'RU' | 'EN';

export function localeFromCode(code: string | null | undefined): NotifyLocale {
  const base = (code ?? '').toLowerCase().split('-')[0];
  if (base === 'ru') return 'RU';
  return 'EN';
}

export interface NotifyRow {
  kind: string;
  payload: Record<string, unknown>;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const raw = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Messages go out with `parse_mode: 'HTML'` so a project can be a link, which
 * makes every name a potential markup injection: «<b>» in a project name
 * would either break the message or style it. All payload text passes here.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const str = (value: unknown): string => escapeHtml(raw(value));

/**
 * The project that moved you, the way a person would point at it. A Telegram
 * channel or profile is its @username — Telegram links that by itself. Any
 * other site is its name with the link hidden under it: «Google», not
 * «https://google.com». Without project data (rows queued before the payload
 * carried it) the owner's handle is the fallback.
 */
export function projectMention(name: string, url: string, fallback: string): string {
  const username = url ? channelUsername(url) : null;
  if (username) return `@${username}`;
  if (name && /^https?:\/\//i.test(url)) {
    return `<a href="${escapeHtml(url)}">${escapeHtml(name)}</a>`;
  }
  return escapeHtml(fallback || name);
}

/**
 * Amounts in a message are points, that is roubles: the bot reports a moving
 * bid, not a card charge, so the unit is the same in both languages.
 *
 * Digit groups are split with a no-break space: in Telegram an amount must
 * never wrap onto the next line halfway.
 */
function money(points: number): string {
  const grouped = Math.abs(points)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} ₽`;
}

/** «4 д 6 ч» — крупная единица вперёд, минуты только пока нет часов. */
function held(seconds: number, locale: NotifyLocale): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  const unit = {
    RU: ['д', 'ч', 'мин'],
    EN: ['d', 'h', 'min'],
  }[locale];

  if (days > 0) return `${days} ${unit[0]} ${hours} ${unit[1]}`;
  if (hours > 0) return `${hours} ${unit[1]}`;
  return `${minutes} ${unit[2]}`;
}

/**
 * Russian plural after a number: 1 раз, 2 раза, 5 раз, 21 раз, 112 раз.
 *
 * Only the attack streak needs it, but it does: `count` is unbounded, and
 * «5 раза» in a message about lost money reads like a machine translation.
 * English has a single form, so it is left alone.
 */
function timesRu(count: number): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return `${count} раз`;
  const last = count % 10;
  if (last === 1) return `${count} раз`;
  if (last >= 2 && last <= 4) return `${count} раза`;
  return `${count} раз`;
}

function topName(top: string, locale: NotifyLocale): string {
  const paid = { RU: 'платном топе', EN: 'Paid Top' };
  const free = { RU: 'бесплатном топе', EN: 'Free Top' };
  return top === 'free' ? free[locale] : paid[locale];
}

function attacked(p: Record<string, unknown>, locale: NotifyLocale): string {
  const project = str(p.project_name);
  const attacker = projectMention(raw(p.attacker_project), raw(p.attacker_url), raw(p.attacker));
  const count = Math.max(1, num(p.count));
  const lost = money(num(p.amount));
  const before = num(p.rank_before);
  const after = num(p.rank_after);
  // Ранг мог и не измениться: удар, не сдвинувший позицию, всё равно стоит
  // денег и всё равно новость — но врать про падение в этом случае нельзя.
  const moved = after > before;

  if (locale === 'RU') {
    const head =
      count > 1
        ? `⚔️ Тебя атаковали ${timesRu(count)} подряд: −${lost} у «${project}».`
        : `⚔️ ${attacker} атаковал тебя: −${lost} у «${project}».`;
    return moved
      ? `${head} Ты упал с #${before} на #${after}.`
      : `${head} Ты держишься на #${after}.`;
  }

  const head =
    count > 1
      ? `⚔️ You were attacked ${count} times in a row: −${lost} off "${project}".`
      : `⚔️ ${attacker} attacked you: −${lost} off "${project}".`;
  return moved
    ? `${head} You dropped from #${before} to #${after}.`
    : `${head} You are holding at #${after}.`;
}

/**
 * Потеря первого места. Корона стоит здесь, а не на карточке победителя:
 * сообщение приходит ровно в тот момент, когда она перешла к другому, и это
 * единственная новость, ради которой его открывают.
 *
 * Кто занял место — главный вопрос, и до сих пор ответа в сообщении не было.
 * Если нового лидера посчитать не удалось, строка про него просто не
 * появляется: пустое «место занял » хуже, чем его отсутствие.
 */
function rankLost(p: Record<string, unknown>, locale: NotifyLocale): string {
  const project = str(p.project_name);
  const where = topName(str(p.top), locale);
  const kept = held(num(p.held_seconds), locale);
  const winner = projectMention(raw(p.winner_project), raw(p.winner_url), raw(p.winner));

  if (locale === 'RU') {
    const head = `👑 Ты больше не первый в ${where}: «${project}» держал корону ${kept}.`;
    return winner ? `${head} Место занял ${winner}.` : head;
  }

  const head = `👑 You are no longer #1 in the ${where}: "${project}" held the crown for ${kept}.`;
  return winner ? `${head} ${winner} took the spot.` : head;
}

/**
 * `count` — число слившихся событий, то есть отданных голосов, а НЕ число
 * людей: один человек, проголосовавший трижды за окно, даёт count = 3. Пока
 * сообщение говорило «от 3 чел.», оно врало ровно этим (находка ревью 1.9);
 * считать разных голосовавших пришлось бы хранить их список в payload, а
 * число отдач и само по себе честная величина.
 */
function votes(p: Record<string, unknown>, locale: NotifyLocale): string {
  const project = str(p.project_name);
  const amount = num(p.amount);
  const times = Math.max(1, num(p.count));

  if (locale === 'RU') {
    return times > 1
      ? `🗳 Твоему проекту «${project}» отдали +${amount} голосов — ${times} отдачи за раз.`
      : `🗳 Твоему проекту «${project}» отдали +${amount} голосов.`;
  }
  return times > 1
    ? `🗳 Your project "${project}" got +${amount} votes — ${times} separate votes.`
    : `🗳 Your project "${project}" got +${amount} votes.`;
}

function referral(p: Record<string, unknown>, locale: NotifyLocale): string {
  const amount = num(p.amount);
  const friends = Math.max(1, num(p.count));

  if (locale === 'RU') {
    return friends > 1
      ? `🤝 +${amount} голосов: ${friends} приглашённых тобой выполнили первое задание.`
      : `🤝 +${amount} голосов: приглашённый тобой выполнил первое задание.`;
  }
  return friends > 1
    ? `🤝 +${amount} votes: ${friends} people you invited finished their first task.`
    : `🤝 +${amount} votes: someone you invited finished their first task.`;
}

/** Подпись кнопки, открывающей мини-апп. */
export function buttonText(locale: NotifyLocale): string {
  if (locale === 'RU') return 'Открыть BidWar';
  return 'Open BidWar';
}

/**
 * Текст сообщения. Неизвестный вид — `null`, а не заглушка: лучше строка
 * зависнет в очереди с ошибкой, чем человек получит пустое сообщение.
 */
export function renderNotification(row: NotifyRow, locale: NotifyLocale): string | null {
  const payload = row.payload ?? {};
  switch (row.kind) {
    case 'attacked':
      return attacked(payload, locale);
    case 'rank_lost':
      return rankLost(payload, locale);
    case 'votes':
      return votes(payload, locale);
    case 'referral':
      return referral(payload, locale);
    default:
      return null;
  }
}
