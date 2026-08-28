import { useEffect, useState, type ReactNode } from 'react';
import { authenticate } from '@/shared/api';
import { getPlatform } from '@/shared/platform';
import { SessionContext, EMPTY_SESSION, type Session } from './context';

/**
 * Один заход в auth на весь мини-апп, а не на каждую страницу. Своей сессии
 * это не заводит (см. 05 Аккаунты и авторизация) — просто держит профиль
 * (userId, баланс голосов) под рукой для тех мест, которым он нужен.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => ({
    ...EMPTY_SESSION,
    status: getPlatform().getInitData() ? 'loading' : 'guest',
  }));

  useEffect(() => {
    const initData = getPlatform().getInitData();
    if (!initData) return;

    let cancelled = false;
    authenticate(initData)
      .then(
        (result) =>
          !cancelled &&
          setSession({
            status: 'ready',
            userId: result.userId,
            displayName: result.displayName,
            avatarUrl: result.avatarUrl,
            voteBalance: result.voteBalance,
            errorMessage: null,
          }),
      )
      .catch(
        (error) =>
          !cancelled &&
          setSession({
            ...EMPTY_SESSION,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : String(error),
          }),
      );

    return () => {
      cancelled = true;
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
