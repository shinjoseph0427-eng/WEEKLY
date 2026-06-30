// Solo 1:1 chat messages — ported from web src/lib/soloMessages.js (KEEP).
// Realtime is RN-identical. Keyed by match_id.
import { supabase } from '../../lib/supabase';
import { getMySoloMatches } from '../matching/solo';
import type { SenderProfile, SoloMessage } from '../../types/db';

// profiles display fields — actual schema (name + photos[]).
const SENDER_FIELDS = 'id, username, name, photos';

// ─────────────────────────────────────────────────────────
// 1. Fetch messages (oldest first)
// ─────────────────────────────────────────────────────────
export async function getSoloMessages(
  matchId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<SoloMessage[]> {
  const { limit = 50, before } = opts;

  let query = supabase
    .from('solo_messages')
    .select(`
      id, match_id, sender_user_id, content, is_system, created_at,
      sender:profiles!solo_messages_sender_user_id_fkey(${SENDER_FIELDS})
    `)
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as SoloMessage[];
}

// ─────────────────────────────────────────────────────────
// 2. Latest message per match (for chat-list previews)
// ─────────────────────────────────────────────────────────
export async function getLatestSoloMessages(
  matchIds: string[] = [],
): Promise<Map<string, SoloMessage>> {
  const ids = [...new Set(matchIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('solo_messages')
    .select(`
      id, match_id, sender_user_id, content, is_system, created_at,
      sender:profiles!solo_messages_sender_user_id_fkey(${SENDER_FIELDS})
    `)
    .in('match_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const latest = new Map<string, SoloMessage>();
  for (const msg of (data || []) as unknown as SoloMessage[]) {
    if (!latest.has(msg.match_id)) latest.set(msg.match_id, msg);
  }
  return latest;
}

export async function sendSoloMessage(matchId: string, content: string): Promise<SoloMessage> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error('Message is empty.');

  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const { data, error } = await supabase
    .from('solo_messages')
    .insert({ match_id: matchId, sender_user_id: myId, content: trimmed })
    .select(`
      id, match_id, sender_user_id, content, is_system, created_at,
      sender:profiles!solo_messages_sender_user_id_fkey(${SENDER_FIELDS})
    `)
    .single();

  if (error) throw error;
  return data as unknown as SoloMessage;
}

// ─────────────────────────────────────────────────────────
// 3. Realtime subscribe — returns a cleanup fn (matches existing pattern)
// ─────────────────────────────────────────────────────────
export function subscribeSoloMessages(
  matchId: string,
  onMessage: (msg: SoloMessage) => void,
): () => void {
  const channel = supabase
    .channel(`solo_messages:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'solo_messages',
        filter: `match_id=eq.${matchId}`,
      },
      async (payload) => {
        const next = payload.new as SoloMessage;
        // System messages (e.g. "X left the chat") have no author — skip the
        // sender lookup so a null sender_user_id can't break the subscription.
        if (next.is_system || !next.sender_user_id) {
          onMessage({ ...next, sender: null });
          return;
        }
        // realtime payload has no join, so fetch the sender separately.
        const { data: sender } = await supabase
          .from('profiles')
          .select(SENDER_FIELDS)
          .eq('id', next.sender_user_id)
          .single();
        onMessage({ ...next, sender: sender as unknown as SenderProfile });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─────────────────────────────────────────────────────────
// 4. Delete a message (own only)
// ─────────────────────────────────────────────────────────
export async function deleteSoloMessage(messageId: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  const { error } = await supabase
    .from('solo_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_user_id', myId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// 5. Unread count (for badges)
// ─────────────────────────────────────────────────────────
export async function getSoloUnreadCount(
  matchId: string,
  lastReadAt?: string,
): Promise<number> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  let query = supabase
    .from('solo_messages')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .neq('sender_user_id', myId);

  if (lastReadAt) query = query.gt('created_at', lastReadAt);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────
// 6. Read state — per-match "last read" markers (solo_match_reads)
// ─────────────────────────────────────────────────────────

// Mark a match as read up to now for the current user (upsert their marker).
export async function markSoloMatchRead(matchId: string): Promise<void> {
  if (!matchId) return;
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) return;

  const { error } = await supabase.from('solo_match_reads').upsert(
    { match_id: matchId, user_id: myId, last_read_at: new Date().toISOString() },
    { onConflict: 'match_id,user_id' },
  );
  // Best-effort: a failed read-marker must never break the chat UI.
  if (error) console.warn('markSoloMatchRead failed:', error.message);
}

// Returns Map<matchId, lastReadAt ISO string> for the current user.
export async function getSoloMatchReads(
  matchIds: string[] = [],
): Promise<Map<string, string>> {
  const ids = [...new Set(matchIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) return new Map();

  const { data, error } = await supabase
    .from('solo_match_reads')
    .select('match_id, last_read_at')
    .eq('user_id', myId)
    .in('match_id', ids);

  if (error) {
    // Table missing (pre-migration) → treat everything as unread, don't throw.
    if (error.code === '42P01' || error.code === 'PGRST205') return new Map();
    throw error;
  }

  const reads = new Map<string, string>();
  for (const row of (data || []) as { match_id: string; last_read_at: string }[]) {
    reads.set(row.match_id, row.last_read_at);
  }
  return reads;
}

// Unread count per match for the current user: Map<matchId, count>.
export async function getSoloUnreadCounts(
  matchIds: string[] = [],
): Promise<Map<string, number>> {
  const ids = [...new Set(matchIds.filter(Boolean))];
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  const reads = await getSoloMatchReads(ids).catch(() => new Map<string, string>());
  const results = await Promise.all(
    ids.map((id) => getSoloUnreadCount(id, reads.get(id)).catch(() => 0)),
  );
  ids.forEach((id, i) => counts.set(id, results[i]));
  return counts;
}

// Total unread messages across all of my active matches (for the tab badge).
export async function getTotalSoloUnread(): Promise<number> {
  const matches = await getMySoloMatches().catch(() => []);
  const ids = matches.map((m) => m.matchId);
  if (ids.length === 0) return 0;
  const counts = await getSoloUnreadCounts(ids);
  let total = 0;
  for (const n of counts.values()) total += n;
  return total;
}
