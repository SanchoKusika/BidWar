/**
 * Вызовы Bot API, нужные для subscribe-заданий.
 *
 * Отдельно от `telegram.ts`: там проверка подписи initData, чистая
 * криптография без сети, а здесь наоборот — только сеть. Смешивать их значит
 * тянуть fetch в тесты, которые сейчас гоняются без сети вообще.
 */

/** Статусы, при которых человек считается подписанным (06 Telegram-бот). */
const SUBSCRIBED = ['creator', 'administrator', 'member'] as const;

/** Права бота, достаточные для достоверного `getChatMember` по чужому лицу. */
const BOT_IS_ADMIN = ['creator', 'administrator'] as const;

interface ChatMemberResponse {
  ok: boolean;
  result?: { status?: string };
  description?: string;
}

interface ChatResponse {
  ok: boolean;
  result?: { id?: number; type?: string; username?: string; title?: string };
  description?: string;
}

async function call<T>(botToken: string, method: string, params: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  return (await response.json()) as T;
}

/** id бота — это часть токена до двоеточия, отдельный запрос за ним не нужен. */
export function botIdFromToken(botToken: string): number | null {
  const id = Number(botToken.split(':')[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export interface ChannelLookup {
  chatId: number;
  title: string | null;
}

/**
 * Канал по юзернейму. Отсутствие канала — это не сбой, а обычный ответ: в
 * ссылке проекта может стоять что угодно, вплоть до личного профиля.
 */
export async function findChannel(
  botToken: string,
  username: string,
): Promise<ChannelLookup | null> {
  const data = await call<ChatResponse>(botToken, 'getChat', { chat_id: `@${username}` });
  const id = data.ok ? data.result?.id : undefined;
  return typeof id === 'number' ? { chatId: id, title: data.result?.title ?? null } : null;
}

/**
 * Админ ли бот в этом чате. Без прав `getChatMember` по чужому пользователю
 * может вернуть `left` для реально подписанного человека — поэтому проверка
 * прав идёт первой, до любых начислений.
 */
export async function isBotAdmin(botToken: string, chatId: number): Promise<boolean> {
  const botId = botIdFromToken(botToken);
  if (botId === null) return false;

  const data = await call<ChatMemberResponse>(botToken, 'getChatMember', {
    chat_id: chatId,
    user_id: botId,
  });
  const status = data.ok ? data.result?.status : undefined;
  return BOT_IS_ADMIN.includes(status as (typeof BOT_IS_ADMIN)[number]);
}

/** Подписан ли человек. Отказ Bot API считается «не подписан», а не ошибкой. */
export async function isSubscribed(
  botToken: string,
  chatId: number,
  telegramUserId: number,
): Promise<boolean> {
  const data = await call<ChatMemberResponse>(botToken, 'getChatMember', {
    chat_id: chatId,
    user_id: telegramUserId,
  });
  const status = data.ok ? data.result?.status : undefined;
  return SUBSCRIBED.includes(status as (typeof SUBSCRIBED)[number]);
}

export interface SendResult {
  ok: boolean;
  /** Текст отказа Telegram — уходит в `notifications.last_error` как есть. */
  description?: string;
  /** Отказ, который не лечится повтором: человек не начинал диалог или заблокировал бота. */
  permanent: boolean;
}

/**
 * Отказы, которые не лечатся повтором, — про самого адресата: он не начинал
 * диалог, заблокировал бота или такого чата нет.
 *
 * Остальные 400 повторять обязательно. Telegram отвечает 400 и на
 * `BUTTON_TYPE_INVALID` — то есть на неверно настроенный домен мини-аппа, — а
 * это ошибка конфигурации, общая для ВСЕХ сообщений сразу. Считать её
 * окончательной значит похоронить всю очередь целиком при первой же опечатке в
 * `APP_URL`, причём чинить будет уже нечего.
 */
const PERMANENT_DESCRIPTIONS = [
  'chat not found',
  'user not found',
  'bot was blocked',
  'deactivated',
];

export function isPermanent(
  errorCode: number | undefined,
  description: string | undefined,
): boolean {
  if (errorCode === 403) return true;
  if (errorCode !== 400) return false;
  const text = (description ?? '').toLowerCase();
  return PERMANENT_DESCRIPTIONS.some((known) => text.includes(known));
}

/**
 * Сообщение человеку с кнопкой, открывающей мини-апп.
 *
 * Писать можно только тем, кто сам начал диалог с ботом
 * ([[06 Telegram-бот и Mini App]]). Проверять это заранее нечем: `initData`
 * отдаёт `allows_write_to_pm` только при открытии мини-аппа, а очередь
 * разбирается потом и без человека. Поэтому запрет узнаётся из ответа.
 *
 * Ничего не бросает: сеть — это неудача одного сообщения, а не повод уронить
 * разбор всей пачки, у которой попытка уже списана.
 */
export async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  button: { text: string; url: string },
): Promise<SendResult> {
  let data: { ok?: boolean; description?: string; error_code?: number };

  try {
    data = await call<{ ok?: boolean; description?: string; error_code?: number }>(
      botToken,
      'sendMessage',
      {
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: button.text, web_app: { url: button.url } }]],
        },
      },
    );
  } catch (error) {
    // Сеть, TLS, не-JSON от шлюза. Это неудача одного сообщения, а не повод
    // уронить разбор всей пачки: у остальных строк попытка уже списана.
    return {
      ok: false,
      description: error instanceof Error ? error.message : 'network error',
      permanent: false,
    };
  }

  return {
    ok: data.ok === true,
    description: data.description,
    permanent: isPermanent(data.error_code, data.description),
  };
}

/**
 * Юзернейм канала из ссылки проекта. `t.me/joinchat/...` и `t.me/+hash` — это
 * приглашения в закрытый чат, а не публичный канал: по ним `getChat` не
 * работает, и их надо отсеять здесь, а не получать невнятный отказ от API.
 */
export function channelUsername(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!/^(www\.)?t\.me$/i.test(parsed.hostname)) return null;

  const first = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  if (first === '' || first.startsWith('+') || first.toLowerCase() === 'joinchat') return null;
  if (!/^[A-Za-z0-9_]{5,32}$/.test(first)) return null;

  return first;
}
