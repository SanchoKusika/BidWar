import { useSignIn } from '@/shared/lib/signIn';
import { useSession } from './context';

/**
 * «Sign in with Telegram» for a viewer the site has no account for: a guest,
 * or a kept sign-in the server no longer takes. Null in the mini app, where
 * Telegram itself signs the person in, and for anyone signed in — there every
 * action does what it says.
 *
 * Screens offer it instead of an action that needs an account: a payment or a
 * vote without one could only fail at the very end.
 */
export function useGuestSignIn(): (() => void) | null {
  const signIn = useSignIn();
  const { status } = useSession();
  return status === 'guest' || status === 'error' ? signIn : null;
}
