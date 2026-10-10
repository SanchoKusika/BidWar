import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { exchangeWebLogin, fetchHealth } from '@/shared/api';
import {
  PopupBlockedError,
  preloadTelegramLogin,
  saveLogin,
  signInWithTelegram,
} from '@/shared/platform';
import { dropQueryCache } from '@/shared/lib/query';
import { SignInContext } from '@/shared/lib/signIn';
import { strings } from '@/shared/i18n/strings';
import { useSettings } from '@/shared/settings';
import { Button } from '@/shared/ui/Button';
import { useSession } from '@/entities/user';
import { Sheet } from '@/widgets/mobile/Sheet';
import { SheetHeader } from '@/widgets/mobile/SheetHeader';
import { SheetNote } from '@/widgets/mobile/SheetParts';

/**
 * The bot the server checks against — its id is the Client ID in BotFather.
 * It comes from `health`, never from a build setting that could name another
 * bot, and is kept once known: the tap needs it at hand, not on the way.
 */
let knownBotId: number | null = null;
let botIdRequest: Promise<number> | null = null;

function loadBotId(): Promise<number> {
  if (knownBotId !== null) return Promise.resolve(knownBotId);
  botIdRequest ??= fetchHealth()
    .then(({ botId }) => {
      if (!botId) throw new Error('health named no bot');
      knownBotId = botId;
      return botId;
    })
    .catch((error: unknown) => {
      botIdRequest = null;
      throw error;
    });
  return botIdRequest;
}

type Failure = 'blocked' | 'failed';

/**
 * «Sign in with Telegram» on the site — on a desktop and on a phone alike.
 * Telegram's popup gives an ID token, `auth-web` trades it for the site's own
 * credential, and the site reloads, so the session, the cache and every
 * screen start over as this account.
 *
 * A phone's browser opens a window only in direct answer to a tap, and a
 * request or a script load in between is enough to lose that — the button
 * then did nothing at all. So the bot's id and Telegram's library are fetched
 * as soon as someone may need to sign in, and the tap itself only opens the
 * window. Lives under a SessionProvider: it is the session that says so.
 */
export function SiteSignIn({ children }: { children: ReactNode }) {
  const { language } = useSettings();
  const { status } = useSession();
  const [failure, setFailure] = useState<Failure | null>(null);
  const mayNeed = status === 'guest' || status === 'error';

  useEffect(() => {
    if (!mayNeed) return;
    preloadTelegramLogin();
    loadBotId().catch(() => {
      // The tap asks again and reports the failure then.
    });
  }, [mayNeed]);

  const signIn = useCallback(() => {
    setFailure(null);
    const lang = language.toLowerCase();
    const token =
      knownBotId !== null
        ? signInWithTelegram(knownBotId, lang)
        : loadBotId().then((botId) => signInWithTelegram(botId, lang));
    token
      .then(async (idToken) => {
        if (!idToken) return;
        saveLogin(await exchangeWebLogin(idToken));
        dropQueryCache();
        window.location.reload();
      })
      .catch((error: unknown) => {
        setFailure(error instanceof PopupBlockedError ? 'blocked' : 'failed');
      });
  }, [language]);

  return (
    <SignInContext.Provider value={signIn}>
      {children}
      {/* The way back from a failure is the same button: by now everything
          is loaded, and a second tap opens the window inside the tap. */}
      <Sheet open={failure !== null} onClose={() => setFailure(null)}>
        <SheetHeader icon="send" title={strings.web.signInProblem} />
        <SheetNote tone="muted" icon="triangle-alert">
          {failure === 'blocked' ? strings.web.signInBlocked : strings.web.signInFailed}
        </SheetNote>
        <Button variant="primary" size="lg" block icon="send" onClick={signIn}>
          {strings.web.signIn}
        </Button>
      </Sheet>
    </SignInContext.Provider>
  );
}
