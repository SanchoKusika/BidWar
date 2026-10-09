import { useEffect, useSyncExternalStore } from 'react';
import { getOnlineCount, joinOnline, subscribeOnline } from '@/shared/api/presence';

/**
 * Counts this person as online while the app is open — under their account
 * once signed in, under this browser before that (`shared/api/presence.ts`).
 * Called by each shell inside its session, so the key follows the session.
 */
export function useJoinOnline(userId: string | null): void {
  useEffect(() => joinOnline(userId), [userId]);
}

/** How many people have BidWar open right now; null until the first sync. */
export function useOnlineCount(): number | null {
  return useSyncExternalStore(subscribeOnline, getOnlineCount, getOnlineCount);
}
