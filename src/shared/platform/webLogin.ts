/**
 * Sign-in on the site through Telegram's «Log in with Telegram» popup
 * (OpenID Connect, https://core.telegram.org/bots/telegram-login).
 *
 * The popup returns an ID token that lives an hour; the `auth-web` function
 * checks it and hands back the site's own thirty-day credential in the Login
 * Widget format. That credential, kept on the device, is the site's session:
 * `getInitData()` of the web platform returns it, and every function that
 * already checks the mini app's `initData` checks it too
 * (`_shared/telegram.ts`). Lives in the platform layer because it is the only
 * other place that touches `window.Telegram`.
 */

const STORAGE_KEY = 'bidwar.login.v1';
const SCRIPT_URL = 'https://telegram.org/js/telegram-login.js';

/** Same limit as the server's: an older answer would only be refused there. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface TelegramLoginResult {
  id_token?: string;
  error?: string;
}

interface TelegramLoginApi {
  auth(
    options: { client_id: number; request_access?: string[]; lang?: string },
    callback: (result: TelegramLoginResult) => void,
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

/** Keeps the credential `auth-web` minted — the site's session from now on. */
export function saveLogin(login: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, login);
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
 * Opens Telegram's sign-in popup for the bot and resolves with its ID token,
 * or null when the person closed it. `write` lets the bot send the attack and
 * rank notices.
 *
 * The library sends the current page as `redirect_uri`, and Telegram checks it
 * against BotFather's list exactly — `/project/42` or `/free` would never
 * match. The address is set to the site root for the moment the popup is
 * built (the library reads it synchronously) and put back right after, so
 * one registered URL, `https://bidwar.world/`, serves every page.
 */
export async function signInWithTelegram(clientId: number, lang: string): Promise<string | null> {
  const api = await loadWidget();
  return new Promise((resolve, reject) => {
    const here = window.location.pathname + window.location.search + window.location.hash;
    const state: unknown = window.history.state;
    if (window.location.pathname !== '/') window.history.replaceState(state, '', '/');
    try {
      api.auth({ client_id: clientId, request_access: ['write'], lang }, (result) => {
        if (result.id_token) resolve(result.id_token);
        else if (!result.error || result.error === 'popup_closed') resolve(null);
        else reject(new Error(result.error));
      });
    } finally {
      if (here !== '/') window.history.replaceState(state, '', here);
    }
  });
}
