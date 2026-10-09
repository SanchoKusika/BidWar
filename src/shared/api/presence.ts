import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './client';

/**
 * Who has BidWar open right now — the «online» counter of the desktop kit.
 *
 * Supabase Realtime Presence, no table: every open mini app and site tab joins
 * one channel under its own key, and the channel's own state is the count. A
 * tab that closes or loses the connection drops out by itself, so the number
 * never needs cleaning up. Counted per open tab, not per person: the same
 * account in the mini app and on the site is two.
 */

const CHANNEL = 'online';

let channel: RealtimeChannel | null = null;
let users = 0;
let count: number | null = null;
const listeners = new Set<() => void>();

function publish(next: number) {
  if (next === count) return;
  count = next;
  for (const listener of listeners) listener();
}

/** Join the channel for as long as the returned function is not called. */
export function joinOnline(): () => void {
  users += 1;
  if (!channel) {
    const key = crypto.randomUUID();
    const joined = getSupabase().channel(CHANNEL, { config: { presence: { key } } });
    joined
      .on('presence', { event: 'sync' }, () => {
        publish(Object.keys(joined.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void joined.track({ since: Date.now() });
      });
    channel = joined;
  }

  return () => {
    users -= 1;
    if (users > 0 || !channel) return;
    void getSupabase().removeChannel(channel);
    channel = null;
    count = null;
  };
}

/** The current count, or null until the channel has synced once. */
export function getOnlineCount(): number | null {
  return count;
}

export function subscribeOnline(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
