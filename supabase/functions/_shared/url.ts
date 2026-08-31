import { badRequest } from './http.ts';

/**
 * Общий лимит длины ссылки для обеих функций, что принимают её от
 * пользователя (add-project, create-payment). Запас с огромным множителем —
 * реальные ссылки на Telegram/соцсети на порядки короче, граница нужна
 * только чтобы не тащить в базу мегабайты мусора.
 */
export const MAX_URL_LENGTH = 2048;

/**
 * Подставляет https://, если пользователь не указал схему вовсе.
 *
 * Люди не набирают протокол сами — «t.me/channel», «instagram.com/user» —
 * а `new URL()` на такой строке бросает: без базы это выглядит как
 * относительный путь, а не как абсолютная ссылка. До этой правки ЛЮБАЯ
 * ссылка без явного http(s):// заваливалась с «Ссылка не распознана» ещё до
 * похода за OG-превью — из-за этого казалось, что не работает конкретно
 * Telegram-канал: OG-фетч для t.me на самом деле прекрасно тянет og:title/
 * og:image (проверено вживую curl'ом), просто до него дело не доходило.
 *
 * Схема уже есть ⇒ `new URL(raw)` не бросает сама по себе — так распознаётся
 * «уже с протоколом» без отдельного regex, и строка не трогается (в том
 * числе посторонние схемы вроде javascript: — их отсеет уже проверка http(s)
 * у вызывающего). Схемы нет ⇒ первая попытка бросает, пробуем с https://.
 *
 * Известное ограничение: «example.com:8080/path» тоже выглядит как «уже со
 * схемой» (домен с точками — валидная по грамматике URI scheme строка до
 * двоеточия), поэтому https:// для такого ввода не подставится, и его
 * отвергнет проверка http(s)-схемы. Реальные ссылки на Telegram/соцсети
 * портов не носят — чинить эту неоднозначность здесь избыточно.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return `https://${trimmed}`;
  }
}

/**
 * Общая точка входа для add-project и create-payment/validate.ts: длина →
 * нормализация схемы → парсинг → проверка http(s). Раньше эти три шага были
 * продублированы дословно в обеих функциях — тот же класс расхождения,
 * из-за которого уже чинили fetchFxRates/parsePaidLimits по отдельности
 * (см. их комментарии в fx.ts и create-payment/validate.ts). Теперь фикс и
 * тест один на обе функции.
 */
export function parseHttpUrl(raw: string, maxLength: number = MAX_URL_LENGTH): URL {
  if (raw.length > maxLength) throw badRequest('Ссылка слишком длинная');

  let parsed: URL;
  try {
    parsed = new URL(normalizeUrl(raw));
  } catch {
    throw badRequest('Ссылка не распознана');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest('Ссылка должна быть http(s)');
  }
  return parsed;
}
