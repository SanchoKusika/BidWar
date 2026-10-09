import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './client';

/**
 * Who has BidWar open right now — the «online» counter of the desktop kit.
 *
 * Supabase Realtime Presence, no table: every open mini app and site joins one
 * channel, and the number of distinct keys in its state is the count. A tab
 * that closes or loses the connection drops out by itself.
 *
 * The key is the person, not the tab: a signed-in account joins under its
 * account, so a phone and a laptop on the same account are one; a guest joins
 * under a key kept in this browser, so their tabs are one too (a guest on two
 * devices cannot be told apart — that takes signing in). The account id is
 * hashed before it goes out: everyone on the channel sees the keys.
 */

const CHANNEL = 'online';
const DEVICE_KEY = 'bidwar.device.v1';

let channel: RealtimeChannel | null = null;
let channelKey: string | null = null;
let wantedKey: string | null = null;
let users = 0;
let count: number | null = null;
const listeners = new Set<() => void>();

function publish(next: number | null) {
  if (next === count) return;
  count = next;
  for (const listener of listeners) listener();
}

/** A random key kept in this browser — a guest's identity for the counter. */
function deviceKey(): string {
  try {
    const kept = localStorage.getItem(DEVICE_KEY);
    if (kept) return kept;
    const fresh = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

async function accountKey(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function leave() {
  if (!channel) return;
  void getSupabase().removeChannel(channel);
  channel = null;
  channelKey = null;
}

/** (Re)joins under `wantedKey` — once per key, so a session landing re-keys the tab. */
function sync() {
  if (users === 0 || !wantedKey || wantedKey === channelKey) return;
  leave();
  const key = wantedKey;
  const joined = getSupabase().channel(CHANNEL, { config: { presence: { key } } });
  joined
    .on('presence', { event: 'sync' }, () => {
      if (channel === joined) publish(Object.keys(joined.presenceState()).length);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void joined.track({ since: Date.now() });
    });
  channel = joined;
  channelKey = key;
}

/**
 * Stay in the channel until the returned function is called. `userId` — the
 * signed-in account, or null for a guest (and while the session is on its way).
 */
export function joinOnline(userId: string | null): () => void {
  users += 1;
  let active = true;
  if (userId) {
    void accountKey(userId).then((key) => {
      if (!active) return;
      wantedKey = key;
      sync();
    });
  } else {
    wantedKey = deviceKey();
    sync();
  }

  return () => {
    active = false;
    users -= 1;
    if (users > 0) return;
    leave();
    wantedKey = null;
    publish(null);
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
