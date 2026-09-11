/**
 * Тексты сообщений бота.
 *
 * Свой словарь, а не `src/shared/i18n`: у функций другой рантайм и другой
 * корень, и тянуть туда клиентский модуль нельзя. Дублирование здесь
 * осознанное и маленькое — четыре сообщения против трёхсот строк интерфейса.
 *
 * Язык берётся из `language_code` Telegram, сохранённого при регистрации. Это
 * тот же источник, с которого стартует и мини-апп; если человек переключил язык
 * руками, бот об этом пока не знает — выбор живёт на устройстве и на сервер не
 * уезжает (срез 1.9, клиентская часть).
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
 */
function money(points: number, locale: NotifyLocale): string {
  const grouped = Math.abs(points)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return locale === 'EN' ? `${grouped} UZS` : `${grouped} so'm`;
}

/** «4 д 6 ч» — дни и часы, без минут: точность тут не нужна, а длина мешает. */
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
        ? `⚔️ «${project}» получил ${count} удара подряд: −${lost}.`
        : `⚔️ ${attacker} атаковал «${project}»: −${lost}.`;
    return moved ? `${head} Ты упал с #${before} на #${after}.` : `${head} Позиция пока #${after}.`;
  }

  if (locale === 'UZ') {
    const head =
      count > 1
        ? `⚔️ «${project}» ketma-ket ${count} zarba oldi: −${lost}.`
        : `⚔️ ${attacker} «${project}» loyihangizga hujum qildi: −${lost}.`;
    return moved
      ? `${head} Siz #${before} dan #${after} ga tushdingiz.`
      : `${head} O'rin hozircha #${after}.`;
  }

  const head =
    count > 1
      ? `⚔️ "${project}" took ${count} hits in a row: −${lost}.`
      : `⚔️ ${attacker} attacked "${project}": −${lost}.`;
  return moved
    ? `${head} You dropped from #${before} to #${after}.`
    : `${head} Still at #${after}.`;
}

function rankLost(p: Record<string, unknown>, locale: NotifyLocale): string {
  const project = str(p.project_name);
  const where = topName(str(p.top), locale);
  const kept = held(num(p.held_seconds), locale);

  if (locale === 'RU') return `«${project}» больше не первый в ${where}. Держал ${kept}.`;
  if (locale === 'UZ') return `«${project}» endi ${where} birinchi emas. ${kept} ushlab turdi.`;
  return `"${project}" is no longer #1 in the ${where}. It held the spot for ${kept}.`;
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
      ? `+${amount} голосов «${project}» — ${times} отдачи за раз.`
      : `+${amount} голосов «${project}».`;
  }
  if (locale === 'UZ') {
    return times > 1
      ? `«${project}» uchun +${amount} ovoz — ${times} marta berildi.`
      : `«${project}» uchun +${amount} ovoz.`;
  }
  return times > 1
    ? `+${amount} votes for "${project}" — ${times} separate votes.`
    : `+${amount} votes for "${project}".`;
}

function referral(p: Record<string, unknown>, locale: NotifyLocale): string {
  const amount = num(p.amount);
  const friends = Math.max(1, num(p.count));

  if (locale === 'RU') {
    return friends > 1
      ? `+${amount} голосов: ${friends} приглашённых выполнили первое задание.`
      : `+${amount} голосов за приглашённого — он выполнил первое задание.`;
  }
  if (locale === 'UZ') {
    return friends > 1
      ? `+${amount} ovoz: ${friends} ta do'stingiz birinchi topshiriqni bajardi.`
      : `+${amount} ovoz — taklif qilganingiz birinchi topshiriqni bajardi.`;
  }
  return friends > 1
    ? `+${amount} votes: ${friends} invites finished their first task.`
    : `+${amount} votes — your invite finished their first task.`;
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
