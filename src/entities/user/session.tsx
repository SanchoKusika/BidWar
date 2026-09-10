import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authenticate } from '@/shared/api';
import { getPlatform } from '@/shared/platform';
import { SessionContext, EMPTY_SESSION, type SessionData } from './context';

/**
 * Один заход в auth на весь мини-апп, а не на каждую страницу. Своей сессии
 * это не заводит (см. 05 Аккаунты и авторизация) — просто держит профиль
 * (userId, баланс голосов) под рукой для тех мест, которым он нужен.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData>(() => ({
    ...EMPTY_SESSION,
    status: getPlatform().getInitData() ? 'loading' : 'guest',
  }));

  const applyVoteBalance = useCallback((voteBalance: number) => {
    setSession((prev) => (prev.voteBalance === voteBalance ? prev : { ...prev, voteBalance }));
  }, []);

  const value = useMemo(() => ({ ...session, applyVoteBalance }), [session, applyVoteBalance]);

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
            username: result.username,
            avatarUrl: result.avatarUrl,
            joinedAt: result.joinedAt,
            invitedCount: result.invitedCount,
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

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
