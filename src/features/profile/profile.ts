// Profile CRUD + username check + fcm token.
// Ported from web src/lib/profile.js (KEEP).
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/db';

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as Profile;
}

// Fetches a single profile by id. Never relies on possibly-stale / RLS-stripped
// data passed via navigation.
export async function getProfileById(userId: string): Promise<Profile | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Profile>,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

  if (error) throw error;
}

export function isProfileOnboardingComplete(
  profile: Partial<Profile> | null | undefined,
): boolean {
  if (profile?.onboarding_complete === true) return true;
  return Boolean(profile?.name && profile?.birth_year);
}

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ fcm_token: token })
    .eq('id', userId);
  if (error) console.error('FCM token save error:', error);
}

// Returns true if available, false if taken
export async function checkUsername(
  username: string,
  excludeUserId: string | null = null,
): Promise<boolean> {
  let query = supabase.from('profiles').select('id').eq('username', username.toLowerCase());
  if (excludeUserId) query = query.neq('id', excludeUserId);
  const { data } = await query.limit(1);
  return !data?.length;
}
