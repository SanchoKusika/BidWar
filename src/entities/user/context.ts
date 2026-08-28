import { createContext, useContext } from 'react';

export type SessionStatus = 'loading' | 'ready' | 'guest' | 'error';

export interface Session {
  status: SessionStatus;
  /** users.id текущего пользователя. null пока не готово/веб-гость/ошибка. */
  userId: string | null;
}

export const SessionContext = createContext<Session>({ status: 'loading', userId: null });

export function useSession(): Session {
  return useContext(SessionContext);
}
