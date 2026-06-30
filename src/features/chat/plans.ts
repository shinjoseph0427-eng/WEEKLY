// Solo plans — propose/confirm/guests + realtime.
// Ported from web src/lib/soloPlans.js (KEEP). Realtime is RN-identical.
import { supabase } from '../../lib/supabase';
import { sendPushForNotification } from '../notifications/notifications';
import type { ProposeSoloPlanFields, SoloPlan, SoloPlanGuest } from '../../types/db';

const PLAN_FIELDS = `
  id,
  match_id,
  proposed_by,
  status,
  day,
  time_label,
  place,
  activity,
  place_lat,
  place_lng,
  place_type,
  google_place_id,
  confirmed_by,
  confirmed_at,
  created_at,
  updated_at
`.trim();

const GUEST_FIELDS = `
  id,
  plan_id,
  invited_by,
  guest_user_id,
  status,
  created_at,
  updated_at,
  responded_at,
  guest:profiles!solo_plan_guests_guest_user_id_fkey(id, username, name, photos, city),
  inviter:profiles!solo_plan_guests_invited_by_fkey(id, username, name, photos, city)
`.trim();

export const PLAN_DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
] as const;

export const PLAN_TIME_PRESETS = [
  'Morning',
  'Lunch',
  'Afternoon',
  'After class',
  'Evening',
  'Night',
] as const;

export function dayLabel(value: string): string {
  return PLAN_DAYS.find((d) => d.value === value)?.label ?? value;
}

export function describePlan(plan: Partial<SoloPlan> | null | undefined): string {
  if (!plan) return '';
  return [dayLabel(plan.day ?? ''), plan.time_label, plan.place, plan.activity]
    .filter(Boolean)
    .join(' · ');
}

export async function getSoloPlan(matchId: string): Promise<SoloPlan | null> {
  if (!matchId) return null;

  const { data, error } = await supabase
    .from('solo_plans')
    .select(PLAN_FIELDS)
    .eq('match_id', matchId)
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null;
    throw error;
  }
  return (data as unknown as SoloPlan) ?? null;
}

export async function proposeSoloPlan(
  matchId: string,
  fields: ProposeSoloPlanFields,
): Promise<SoloPlan | null> {
  const { data, error } = await supabase.rpc('propose_solo_plan', {
    p_match_id: matchId,
    p_day: fields.day,
    p_time_label: fields.time_label,
    p_place: fields.place || null,
    p_activity: fields.activity || null,
    p_place_lat: fields.place_lat ?? null,
    p_place_lng: fields.place_lng ?? null,
    // Venue metadata: category when a suggested venue was picked, else 'other'.
    p_place_type: fields.place_type || 'other',
    p_google_place_id: fields.google_place_id ?? null,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] ?? null : data;
  if (result?.notification_id) {
    await sendPushForNotification(result.notification_id);
  }
  return result?.plan_id ? getSoloPlan(matchId) : null;
}

export async function confirmSoloPlan(planId: string): Promise<SoloPlan | null> {
  const { data, error } = await supabase.rpc('confirm_solo_plan', {
    p_plan_id: planId,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] ?? null : data;
  if (result?.notification_id) {
    await sendPushForNotification(result.notification_id);
  }
  return result?.plan_id ? getSoloPlanById(result.plan_id) : null;
}

export function subscribeSoloPlan(
  matchId: string,
  onChange: (plan: SoloPlan | null) => void,
): () => void {
  if (!matchId) return () => {};

  const channel = supabase
    .channel(`solo_plans:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'solo_plans',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => onChange((payload.new as SoloPlan) ?? null),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getSoloPlanById(planId: string): Promise<SoloPlan | null> {
  if (!planId) return null;

  const { data, error } = await supabase
    .from('solo_plans')
    .select(PLAN_FIELDS)
    .eq('id', planId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as SoloPlan) ?? null;
}

export async function getSoloPlanGuests(planId: string): Promise<SoloPlanGuest[]> {
  if (!planId) return [];

  const { data, error } = await supabase
    .from('solo_plan_guests')
    .select(GUEST_FIELDS)
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }
  return (data as unknown as SoloPlanGuest[]) ?? [];
}

export async function searchSoloPlanGuestCandidates(
  planId: string,
  query: string,
): Promise<unknown[]> {
  const trimmed = query?.trim() ?? '';
  if (!planId || trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc('search_solo_plan_guest_candidates', {
    p_plan_id: planId,
    p_query: trimmed.replace(/^@/, ''),
  });

  if (error) throw error;
  return data ?? [];
}

export async function inviteSoloPlanGuest(
  planId: string,
  guestUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('invite_solo_plan_guest', {
    p_plan_id: planId,
    p_guest_user_id: guestUserId,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] ?? null : data;
  if (result?.notification_id) {
    await sendPushForNotification(result.notification_id);
  }
  return result?.invite_id ?? null;
}

export async function respondSoloPlanGuest(
  inviteId: string,
  accept: boolean,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('respond_solo_plan_guest', {
    p_invite_id: inviteId,
    p_accept: accept,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] ?? null : data;
  if (result?.notification_id) {
    await sendPushForNotification(result.notification_id);
  }
  return result?.invite_id ?? null;
}

export function subscribeSoloPlanGuests(planId: string, onChange: () => void): () => void {
  if (!planId) return () => {};

  const channel = supabase
    .channel(`solo_plan_guests:${planId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'solo_plan_guests',
        filter: `plan_id=eq.${planId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
