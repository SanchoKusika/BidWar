import { useEffect, useState, type ReactNode } from 'react';
import { authenticate } from '@/shared/api';
import { getPlatform } from '@/shared/platform';
import { SessionContext, type Session } from './context';

/**
 * Один заход в auth на весь мини-апп, а не на каждую страницу. Своей сессии
 * это не заводит (см. 05 Аккаунты и авторизация) — просто держит userId под
 * рукой для тех мест, которым он нужен (панель «твоя позиция» и дальше).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() =>
    getPlatform().getInitData()
      ? { status: 'loading', userId: null }
      : { status: 'guest', userId: null },
  );

  useEffect(() => {
    const initData = getPlatform().getInitData();
    if (!initData) return;

    let cancelled = false;
    authenticate(initData)
      .then((result) => !cancelled && setSession({ status: 'ready', userId: result.userId }))
      .catch(() => !cancelled && setSession({ status: 'error', userId: null }));

    return () => {
      cancelled = true;
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
