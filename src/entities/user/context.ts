import { createContext, useContext } from 'react';

export type SessionStatus = 'loading' | 'ready' | 'guest' | 'error';

export interface Session {
  status: SessionStatus;
  /** users.id текущего пользователя. null пока не готово/веб-гость/ошибка. */
  userId: string | null;
  displayName: string | null;
  /** Телеграм-хендл без «@», null — если его нет у аккаунта. */
  username: string | null;
  avatarUrl: string | null;
  /** ISO-дата регистрации, null пока сессия не готова. */
  joinedAt: string | null;
  /** Приглашённых по своей ссылке — реальный счётчик, не заглушка. */
  invitedCount: number;
  /** Баланс голосов — единственный баланс в продукте, деньги нигде не хранятся. */
  voteBalance: number | null;
  /** Текст ошибки auth — только при status === 'error', для видимой диагностики. */
  errorMessage: string | null;
}

export const EMPTY_SESSION: Session = {
  status: 'loading',
  userId: null,
  displayName: null,
  username: null,
  avatarUrl: null,
  joinedAt: null,
  invitedCount: 0,
  voteBalance: null,
  errorMessage: null,
};

export const SessionContext = createContext<Session>(EMPTY_SESSION);

export function useSession(): Session {
  return useContext(SessionContext);
}
