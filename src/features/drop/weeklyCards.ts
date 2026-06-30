// WEEKLY availability cards — ported from web src/lib/weeklyCards.js (KEEP).
// Create/read your weekly card and fetch overlap matches via find_weekly_matches.
import { supabase } from '../../lib/supabase';
import type { WeeklyCard, WeeklyCardInput, WeeklyMatch } from '../../types/db';

/**
 * This week's Monday as a 'YYYY-MM-DD' string (local time).
 * getDay(): 0=Sun..6=Sat → Monday offset is (day === 0 ? -6 : 1 - day).
 */
export function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fetch my weekly card for a given week (defaults to this week). Returns null if none. */
export async function getMyWeeklyCard(weekStart?: string): Promise<WeeklyCard | null> {
  const ws = weekStart ?? currentWeekStart();
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const { data, error } = await supabase
    .from('weekly_cards')
    .select('*')
    .eq('user_id', myId)
    .eq('week_start', ws)
    .maybeSingle();

  if (error) throw error;
  return (data as WeeklyCard | null) ?? null;
}

/** Create (or upsert) my weekly card for this week. */
export async function createWeeklyCard(
  { days, time_slots, place, place_lat, place_lng, vibe }: WeeklyCardInput = {},
): Promise<WeeklyCard> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const { data, error } = await supabase
    .from('weekly_cards')
    .upsert(
      {
        user_id: myId,
        week_start: currentWeekStart(),
        days: days ?? [],
        time_slots: time_slots ?? [],
        place: place ?? null,
        place_lat: place_lat ?? null,
        place_lng: place_lng ?? null,
        vibe: vibe ?? null,
        status: 'open',
      },
      { onConflict: 'user_id,week_start' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as WeeklyCard;
}

/** Update one of my weekly cards (only fields provided are changed). */
export async function updateWeeklyCard(
  id: string,
  fields: WeeklyCardInput = {},
): Promise<WeeklyCard> {
  const { data: me } = await supabase.auth.getUser();
  const myId = me?.user?.id;
  if (!myId) throw new Error('Sign in required');

  const allowed = ['days', 'time_slots', 'place', 'place_lat', 'place_lng', 'vibe', 'status'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) updates[k] = fields[k];
  }

  const { data, error } = await supabase
    .from('weekly_cards')
    .update(updates)
    .eq('id', id)
    .eq('user_id', myId)
    .select()
    .single();

  if (error) throw error;
  return data as WeeklyCard;
}

/** Overlap matches for a given week (defaults to this week) via the RPC. */
export async function getWeeklyMatches(weekStart?: string): Promise<WeeklyMatch[]> {
  const ws = weekStart ?? currentWeekStart();
  const { data, error } = await supabase.rpc('find_weekly_matches', { p_week_start: ws });
  if (error) throw error;
  return (data as WeeklyMatch[]) ?? [];
}

/** Mark still-open cards from before this week as expired (call once on app load). */
export async function expireOldCards(): Promise<void> {
  const { error } = await supabase.rpc('expire_old_weekly_cards');
  if (error) throw error;
}
