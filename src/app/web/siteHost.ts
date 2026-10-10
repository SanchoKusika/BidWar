import { getPlatform } from '@/shared/platform';

/** The mini app's address in BotFather — the same deployment as the site. */
const MINI_APP_HOST = 'app.bidwar.world';
const SITE_ORIGIN = 'https://bidwar.world';

/**
 * The mini app's address opened in a plain browser goes to the site. The
 * bundle there is the same, but signing in is not: Telegram lets it start
 * only from `bidwar.world`, and a sign-in kept on one host is not seen on the
 * other. Inside Telegram the launch data is there and nothing moves. Returns
 * whether the page is leaving, so nothing is drawn on the way out.
 */
export function leaveMiniAppHost(): boolean {
  if (window.location.hostname !== MINI_APP_HOST || getPlatform().name !== 'web') return false;
  const { pathname, search, hash } = window.location;
  window.location.replace(SITE_ORIGIN + pathname + search + hash);
  return true;
}
