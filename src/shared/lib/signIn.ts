import { createContext, useContext } from 'react';

/**
 * «Sign in with Telegram», for screens that offer an action a guest cannot
 * take. The site provides it; in the mini app there is no such thing — the
 * person is always signed in by Telegram itself — and the value is null.
 */
export const SignInContext = createContext<(() => void) | null>(null);

export function useSignIn(): (() => void) | null {
  return useContext(SignInContext);
}
