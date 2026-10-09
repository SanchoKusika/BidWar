import { useEffect, useSyncExternalStore } from 'react';
import { getOnlineCount, joinOnline, subscribeOnline } from '@/shared/api/presence';

/**
 * Counts this tab as online while the app is open. Called once by each shell
 * — the mini app's and the site's — so everyone who has BidWar open is in the
 * number, whichever screen they are on.
 */
export function useJoinOnline(): void {
  useEffect(() => joinOnline(), []);
}

/** How many have BidWar open right now; null until the first sync. */
export function useOnlineCount(): number | null {
  return useSyncExternalStore(subscribeOnline, getOnlineCount, getOnlineCount);
}
