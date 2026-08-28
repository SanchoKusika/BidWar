import { createContext, useContext } from 'react';

export type SessionStatus = 'loading' | 'ready' | 'guest' | 'error';

export interface Session {
  status: SessionStatus;
  /** users.id текущего пользователя. null пока не готово/веб-гость/ошибка. */
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Баланс голосов — единственный баланс в продукте, деньги нигде не хранятся. */
  voteBalance: number | null;
}

export const EMPTY_SESSION: Session = {
  status: 'loading',
  userId: null,
  displayName: null,
  avatarUrl: null,
  voteBalance: null,
};

export const SessionContext = createContext<Session>(EMPTY_SESSION);

export function useSession(): Session {
  return useContext(SessionContext);
}
