/**
 * Sign-in on the site through the Telegram Login Widget.
 *
 * The widget answers with the user's fields and a hash signed with the bot's
 * token. That answer, kept on the device as a query string, is the site's
 * session: `getInitData()` of the web platform returns it, and every function
 * that already checks the mini app's `initData` checks it too — the server
 * tells the two formats apart (`_shared/telegram.ts`). Lives in the platform
 * layer because it is the only other place that touches `window.Telegram`.
 */

const STORAGE_KEY = 'bidwar.login.v1';
const SCRIPT_URL = 'https://telegram.org/js/telegram-widget.js?22';

/** Same limit as the server's: an older answer would only be refused there. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface TelegramLoginUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginApi {
  auth(
    options: { bot_id: number; request_access?: 'write'; lang?: string },
    callback: (user: TelegramLoginUser | false) => void,
  ): void;
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The kept sign-in, or null — none, unreadable, or past its thirty days. */
export function storedLogin(): string | null {
  const raw = read();
  if (!raw) return null;
  const authDate = Number(new URLSearchParams(raw).get('auth_date'));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    clearLogin();
    return null;
  }
  return raw;
}

export function clearLogin(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage switched off — there was nothing kept either.
  }
}

function save(user: TelegramLoginUser): void {
  // Every field the widget signed, as strings, in the form the server checks.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(user)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  try {
    localStorage.setItem(STORAGE_KEY, params.toString());
  } catch {
    // Private mode: the sign-in lasts this page only, which is still a sign-in.
  }
}

let scriptLoad: Promise<TelegramLoginApi> | null = null;

function loadWidget(): Promise<TelegramLoginApi> {
  const existing = (window as { Telegram?: { Login?: TelegramLoginApi } }).Telegram?.Login;
  if (existing) return Promise.resolve(existing);
  if (!scriptLoad) {
    scriptLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const api = (window as { Telegram?: { Login?: TelegramLoginApi } }).Telegram?.Login;
        if (api) resolve(api);
        else reject(new Error('Telegram Login did not load'));
      };
      script.onerror = () => {
        scriptLoad = null;
        reject(new Error('Telegram Login did not load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptLoad;
}

/**
 * Opens Telegram's own sign-in window for the bot and keeps the answer.
 * Resolves true when the person signed in, false when they closed it.
 * `write` access lets the bot send them the attack and rank notices.
 */
export async function signInWithTelegram(botId: number, lang: string): Promise<boolean> {
  const api = await loadWidget();
  return new Promise((resolve) => {
    api.auth({ bot_id: botId, request_access: 'write', lang }, (user) => {
      if (!user) {
        resolve(false);
        return;
      }
      save(user);
      resolve(true);
    });
  });
}
