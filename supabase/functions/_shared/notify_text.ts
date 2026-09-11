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

export type NotifyLocale = 'RU' | 'UZ' | 'EN';

export function localeFromCode(code: string | null | undefined): NotifyLocale {
  const base = (code ?? '').toLowerCase().split('-')[0];
  if (base === 'ru') return 'RU';
  if (base === 'uz') return 'UZ';
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

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Суммы в сообщении — очки, то есть сумы: бот пишет о движении ставки, а не о
 * списании с карты. Валюта показа сюда не доезжает и не должна: она живёт в
 * настройках устройства, а сообщение уходит с сервера.
 *
 * Разряды разделены неразрывным пробелом: в Telegram сумма не имеет права
 * переехать на вторую строку половиной.
 */
function money(points: number, locale: NotifyLocale): string {
  const grouped = Math.abs(points)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return locale === 'EN' ? `${grouped} UZS` : `${grouped} so'm`;
}

/** «4 д 6 ч» — крупная единица вперёд, минуты только пока нет часов. */
function held(seconds: number, locale: NotifyLocale): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  const unit = {
    RU: ['д', 'ч', 'мин'],
    UZ: ['kun', 'soat', 'daq'],
    EN: ['d', 'h', 'min'],
  }[locale];

  if (days > 0) return `${days} ${unit[0]} ${hours} ${unit[1]}`;
  if (hours > 0) return `${hours} ${unit[1]}`;
  return `${minutes} ${unit[2]}`;
}

function topName(top: string, locale: NotifyLocale): string {
  const paid = { RU: 'платном топе', UZ: "to'lovli topda", EN: 'Paid Top' };
  const free = { RU: 'бесплатном топе', UZ: 'bepul topda', EN: 'Free Top' };
  return top === 'free' ? free[locale] : paid[locale];
}

function attacked(p: Record<string, unknown>, locale: NotifyLocale): string {
  const project = str(p.project_name);
  const attacker = str(p.attacker);
  const count = Math.max(1, num(p.count));
  const lost = money(num(p.amount), locale);
  const before = num(p.rank_before);
  const after = num(p.rank_after);
  // Ранг мог и не измениться: удар, не сдвинувший позицию, всё равно стоит
  // денег и всё равно новость — но врать про падение в этом случае нельзя.
  const moved = after > before;

  if (locale === 'RU') {
    const head =
      count > 1
        ? `⚔️ Тебя атаковали ${count} раза подряд: −${lost} у «${project}».`
        : `⚔️ ${attacker} атаковал тебя: −${lost} у «${project}».`;
    return moved
      ? `${head} Ты упал с #${before} на #${after}.`
      : `${head} Ты держишься на #${after}.`;
  }

  if (locale === 'UZ') {
    const head =
      count > 1
        ? `⚔️ Sizga ketma-ket ${count} marta hujum qilishdi: «${project}» −${lost}.`
        : `⚔️ ${attacker} sizga hujum qildi: «${project}» −${lost}.`;
    return moved
      ? `${head} Siz #${before} dan #${after} ga tushdingiz.`
      : `${head} Siz #${after} da turibsiz.`;
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
  const winner = str(p.winner);

  if (locale === 'RU') {
    const head = `👑 Ты больше не первый в ${where}: «${project}» держал корону ${kept}.`;
    return winner ? `${head} Место занял ${winner}.` : head;
  }

  if (locale === 'UZ') {
    const head = `👑 Siz endi ${where} birinchi emassiz: «${project}» tojni ${kept} ushlab turdi.`;
    return winner ? `${head} O'rinni ${winner} egalladi.` : head;
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
  if (locale === 'UZ') {
    return times > 1
      ? `🗳 «${project}» loyihangizga +${amount} ovoz berildi — ${times} marta.`
      : `🗳 «${project}» loyihangizga +${amount} ovoz berildi.`;
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
  if (locale === 'UZ') {
    return friends > 1
      ? `🤝 +${amount} ovoz: siz taklif qilgan ${friends} kishi birinchi topshiriqni bajardi.`
      : `🤝 +${amount} ovoz: siz taklif qilgan do'st birinchi topshiriqni bajardi.`;
  }
  return friends > 1
    ? `🤝 +${amount} votes: ${friends} people you invited finished their first task.`
    : `🤝 +${amount} votes: someone you invited finished their first task.`;
}

/** Подпись кнопки, открывающей мини-апп. */
export function buttonText(locale: NotifyLocale): string {
  if (locale === 'RU') return 'Открыть BidWar';
  if (locale === 'UZ') return 'BidWar ochish';
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
