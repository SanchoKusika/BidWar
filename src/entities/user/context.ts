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
  /**
   * Записать баланс, который вернул сервер после траты или начисления.
   *
   * Не «пересчитать на клиенте»: число приходит из той же хранимки, что его и
   * изменила. Сессия грузится один раз при старте, а голоса меняются во время
   * работы — без этого экран показывал бы баланс до действия до перезапуска
   * мини-аппа.
   */
  applyVoteBalance: (balance: number) => void;
}

export type SessionData = Omit<Session, 'applyVoteBalance'>;

export const EMPTY_SESSION: SessionData = {
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

export const SessionContext = createContext<Session>({
  ...EMPTY_SESSION,
  applyVoteBalance: () => {},
});

export function useSession(): Session {
  return useContext(SessionContext);
}
