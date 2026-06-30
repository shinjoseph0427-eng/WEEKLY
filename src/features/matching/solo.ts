// Solo 1:1 feature — send/accept requests and open chats between two users.
// Ported from web src/lib/solo.js (KEEP). Behavior unchanged.
import { supabase } from '../../lib/supabase';
import { sendPushForNotification } from '../notifications/notifications';
import type {
  SoloDiscoveryUser,
  SoloMatchSummary,
  SoloProfile,
  SoloRequest,
  SoloRequestWithFrom,
  SoloRequestWithTo,
} from '../../types/db';

// ─────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────

// Shared profiles SELECT fields — actual schema columns only (no avatar_url/full_name).
const PROFILE_FIELDS = `
  id,
  username,
  name,
  photos,
  city,
  lat,
  lng,
  instagram,
  bio,
  is_solo
`.trim();

/** Haversine distance (km) */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface CurrentUserLoc {
  id: string;
  lat?: number | null;
  lng?: number | null;
}

export interface FindSoloUsersOpts {
  maxDistanceKm?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────
// 1. Discovery — list users to explore
// ─────────────────────────────────────────────────────────

/**
 * Returns users to explore. Excludes self / blocked / pending requests / active matches,
 * sorted by distance.
 */
export async function findSoloUsers(
  currentUser: CurrentUserLoc,
  opts: FindSoloUsersOpts = {},
): Promise<SoloDiscoveryUser[]> {
  const { maxDistanceKm = 50, limit = 30 } = opts;

  // 1) Blocks (user_blocks: blocker_id / blocked_id)
  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${currentUser.id},blocked_id.eq.${currentUser.id}`);

  const blockedIds = (blocks || []).flatMap((b: { blocker_id: string; blocked_id: string }) => [
    b.blocker_id,
    b.blocked_id,
  ]);

  // 2) Users I currently have a pending request to. Historical requests should
  // not hide a person forever.
  const { data: sentReqs } = await supabase
    .from('solo_requests')
    .select('to_user_id')
    .eq('from_user_id', currentUser.id)
    .eq('status', 'pending');

  const sentToIds = (sentReqs || []).map((r: { to_user_id: string }) => r.to_user_id);

  // 3) Users I'm already matched with
  const { data: myMatches } = await supabase
    .from('solo_matches')
    .select('user_a, user_b')
    .or(`user_a.eq.${currentUser.id},user_b.eq.${currentUser.id}`)
    .eq('status', 'active');

  const matchedIds = (myMatches || []).map((m: { user_a: string; user_b: string }) =>
    m.user_a === currentUser.id ? m.user_b : m.user_a,
  );

  const excludeIds = [
    ...new Set([currentUser.id, ...blockedIds, ...sentToIds, ...matchedIds].filter(Boolean)),
  ];

  // 5) Query users (all users — no is_solo filter, over-fetch then distance-filter)
  const { data: users, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .limit(limit * 3);

  if (error) throw error;

  return ((users || []) as unknown as SoloProfile[])
    .map((u): SoloDiscoveryUser => ({
      ...u,
      distanceKm:
        currentUser.lat && currentUser.lng && u.lat && u.lng
          ? haversineKm(currentUser.lat, currentUser.lng, u.lat, u.lng)
          : null,
    }))
    .filter((u) => u.distanceKm === null || u.distanceKm <= maxDistanceKm)
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────
// 2. Requests — send / list / cancel
// ─────────────────────────────────────────────────────────

export async function sendSoloRequest(toUserId: string): Promise<SoloRequest> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const { data: existingPending, error: pendingError } = await supabase
    .from('solo_requests')
    .select('id')
    .eq('from_user_id', myId)
    .eq('to_user_id', toUserId)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingError) throw pendingError;
  if (existingPending) {
    throw new Error('You already have a pending request with this person.');
  }

  const { data: activeMatches, error: matchError } = await supabase
    .from('solo_matches')
    .select('id')
    .eq('status', 'active')
    .or(`and(user_a.eq.${myId},user_b.eq.${toUserId}),and(user_a.eq.${toUserId},user_b.eq.${myId})`)
    .limit(1);

  if (matchError) throw matchError;
  if ((activeMatches || []).length > 0) {
    throw new Error('You already have an active chat with this person.');
  }

  const { data, error } = await supabase
    .from('solo_requests')
    .insert({ from_user_id: myId, to_user_id: toUserId, status: 'pending' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505')
      throw new Error('You already have a pending request with this person.');
    throw error;
  }

  // Notify + push the recipient (SECURITY DEFINER RPC creates the row and returns its id).
  const { data: notif, error: notifyError } = await supabase.rpc('notify_solo_request', {
    p_request_id: data.id,
  });
  if (notifyError) throw notifyError;

  const row = Array.isArray(notif) ? notif[0] : notif;
  if (row?.id) {
    try {
      await sendPushForNotification(row.id);
    } catch (e) {
      console.warn('sendPushForNotification failed:', (e as Error)?.message);
    }
  }

  return data as SoloRequest;
}

export async function getMySentSoloRequests(): Promise<SoloRequestWithTo[]> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  const { data, error } = await supabase
    .from('solo_requests')
    .select(`
      id, status, created_at,
      to_user:profiles!solo_requests_to_user_id_fkey(${PROFILE_FIELDS})
    `)
    .eq('from_user_id', myId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as SoloRequestWithTo[];
}

export async function getMyReceivedSoloRequests(): Promise<SoloRequestWithFrom[]> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  const { data, error } = await supabase
    .from('solo_requests')
    .select(`
      id, status, created_at,
      from_user:profiles!solo_requests_from_user_id_fkey(${PROFILE_FIELDS})
    `)
    .eq('to_user_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as SoloRequestWithFrom[];
}

export async function cancelSoloRequest(requestId: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  const { error } = await supabase
    .from('solo_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('from_user_id', myId)
    .eq('status', 'pending');

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// 3. Accept / decline
// ─────────────────────────────────────────────────────────

/** Accept → atomic solo_match creation via RPC. Returns match_id (uuid). */
export async function acceptSoloRequest(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_solo_request', {
    p_request_id: requestId,
  });
  if (error) throw error;

  // Notify + push the original sender that their request was accepted.
  const { data: notif, error: notifyError } = await supabase.rpc('notify_solo_accepted', {
    p_request_id: requestId,
  });
  if (notifyError) throw notifyError;

  const row = Array.isArray(notif) ? notif[0] : notif;
  if (row?.id) {
    try {
      await sendPushForNotification(row.id);
    } catch (e) {
      console.warn('sendPushForNotification failed:', (e as Error)?.message);
    }
  }

  return data as string; // match_id
}

export async function declineSoloRequest(requestId: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  const { error } = await supabase
    .from('solo_requests')
    .update({ status: 'declined' })
    .eq('id', requestId)
    .eq('to_user_id', myId)
    .eq('status', 'pending');

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// 4. Matches
// ─────────────────────────────────────────────────────────

// includeEnded:false (default) → active matches only, preserving every existing
// caller's behavior (HomePage, unread-count). The inbox passes includeEnded:true
// so ended matches stay visible as read-only history.
export async function getMySoloMatches(
  { includeEnded = false }: { includeEnded?: boolean } = {},
): Promise<SoloMatchSummary[]> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  let query = supabase
    .from('solo_matches')
    .select(`
      id, status, matched_at, ended_at,
      user_a_profile:profiles!solo_matches_user_a_fkey(${PROFILE_FIELDS}),
      user_b_profile:profiles!solo_matches_user_b_fkey(${PROFILE_FIELDS})
    `)
    .or(`user_a.eq.${myId},user_b.eq.${myId}`)
    .order('matched_at', { ascending: false });

  query = includeEnded
    ? query.in('status', ['active', 'ended'])
    : query.eq('status', 'active');

  const [{ data, error }, deletedResult] = await Promise.all([
    query,
    includeEnded
      ? supabase.from('solo_chat_deletions').select('match_id').eq('user_id', myId)
      : Promise.resolve({ data: [] as { match_id: string }[], error: null }),
  ]);

  if (error) throw error;
  if (deletedResult.error) throw deletedResult.error;

  const deletedMatchIds = new Set(
    (deletedResult.data || []).map((row: { match_id: string }) => row.match_id),
  );

  type MatchRow = {
    id: string;
    status: SoloMatchSummary['status'];
    matched_at: string;
    user_a_profile: (SoloProfile | null) | SoloProfile[];
    user_b_profile: (SoloProfile | null) | SoloProfile[];
  };

  const pick = (p: MatchRow['user_a_profile']): SoloProfile | null =>
    (Array.isArray(p) ? p[0] : p) ?? null;

  const mapped: SoloMatchSummary[] = ((data || []) as unknown as MatchRow[])
    .filter((m) => !deletedMatchIds.has(m.id))
    .map((m) => {
      const a = pick(m.user_a_profile);
      const b = pick(m.user_b_profile);
      return {
        matchId: m.id,
        status: m.status,
        matchedAt: m.matched_at,
        partner: a?.id === myId ? b : a,
      };
    });

  // Dedup by matchId — a row should never repeat, but guard the UI against any
  // query-level duplication so the same chat can't render twice.
  const byId = new Map<string, SoloMatchSummary>();
  for (const m of mapped) {
    if (!byId.has(m.matchId)) byId.set(m.matchId, m);
  }
  return [...byId.values()];
}

export async function deleteEndedSoloChat(matchId: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const { error } = await supabase
    .from('solo_chat_deletions')
    .insert({ match_id: matchId, user_id: myId });

  if (error) throw error;
}

export async function getSoloMatch(matchId: string): Promise<{ partner: SoloProfile | null }> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;

  const { data, error } = await supabase
    .from('solo_matches')
    .select(`
      id, status, matched_at,
      user_a_profile:profiles!solo_matches_user_a_fkey(${PROFILE_FIELDS}),
      user_b_profile:profiles!solo_matches_user_b_fkey(${PROFILE_FIELDS})
    `)
    .eq('id', matchId)
    .single();

  if (error) throw error;

  const row = data as unknown as {
    user_a_profile: (SoloProfile | null) | SoloProfile[];
    user_b_profile: (SoloProfile | null) | SoloProfile[];
  };
  const pick = (p: typeof row.user_a_profile): SoloProfile | null =>
    (Array.isArray(p) ? p[0] : p) ?? null;
  const a = pick(row.user_a_profile);
  const b = pick(row.user_b_profile);
  const partner = a?.id === myId ? b : a;
  return { ...(data as object), partner } as { partner: SoloProfile | null };
}

// ─────────────────────────────────────────────────────────
// 5. profiles is_solo toggle
// ─────────────────────────────────────────────────────────

export async function updateIsSolo(isSolo: boolean): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const { error } = await supabase.from('profiles').update({ is_solo: isSolo }).eq('id', myId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// 6. Leave match — atomic via RPC: ends the match, posts a system message in
//    the thread, and notifies the other person (+ push).
// ─────────────────────────────────────────────────────────

export async function leaveSoloMatch(matchId: string): Promise<void> {
  const { data, error } = await supabase.rpc('leave_solo_match', {
    p_match_id: matchId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.notification_id) {
    try {
      await sendPushForNotification(row.notification_id);
    } catch (e) {
      console.warn('sendPushForNotification failed:', (e as Error)?.message);
    }
  }
}
