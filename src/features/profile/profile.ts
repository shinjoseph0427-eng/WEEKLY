// Profile CRUD + username check + fcm token.
// Ported from web src/lib/profile.js (KEEP).
import { supabase } from '../../lib/supabase';
import { assertUUID } from '../../lib/constants';
import { isAtLeastAge, parseISODate } from '../../lib/age';
import type { Profile } from '../../types/db';

// Minimum photos required to complete onboarding (real dating/social standard).
export const MIN_ONBOARDING_PHOTOS = 3;
export const MIN_AGE = 18;

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

// Source of truth for routing (app/_layout.tsx): a profile is only considered
// onboarded when the DB flag is explicitly true. name/birth_year alone do NOT
// count — a half-seeded row (trigger sets onboarding_complete = false) must
// still be sent through onboarding.
export function isProfileOnboardingComplete(
  profile: Partial<Profile> | null | undefined,
): boolean {
  return profile?.onboarding_complete === true;
}

// Fields the onboarding / profile-creation screen is allowed to write. Every
// key maps to an existing public.profiles column (see src/types/db.ts); the
// screen never sends anything outside this shape. birth_date is the source of
// truth; birth_year is stored as its year for compatibility.
export interface OnboardingProfileInput {
  name: string;
  birth_date: string; // 'YYYY-MM-DD'
  birth_year: number;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  bio?: string | null;
  photos: string[]; // uploaded URLs; must be >= MIN_ONBOARDING_PHOTOS
}

// Narrow, purpose-built writer for first-run onboarding. Re-validates the gate
// requirements here (not just in the UI) so onboarding_complete can never be set
// true from bypassed client state. Restricts the update to allowed columns and
// asserts the target id; RLS still scopes the update to the caller's own row.
export async function completeOnboarding(
  userId: string,
  input: OnboardingProfileInput,
): Promise<Profile> {
  assertUUID(userId, 'userId');

  if (!input.name.trim()) throw new Error('Name is required.');

  const birthDate = parseISODate(input.birth_date);
  if (!birthDate) throw new Error('A valid date of birth is required.');
  if (!isAtLeastAge(birthDate, MIN_AGE)) {
    throw new Error(`You must be at least ${MIN_AGE} to use WEEKLY.`);
  }

  if (!Array.isArray(input.photos) || input.photos.length < MIN_ONBOARDING_PHOTOS) {
    throw new Error(`At least ${MIN_ONBOARDING_PHOTOS} photos are required.`);
  }

  const patch: Partial<Profile> = {
    name: input.name.trim(),
    birth_date: input.birth_date,
    birth_year: input.birth_year,
    photos: input.photos,
    onboarding_complete: true,
  };
  if (input.city !== undefined) patch.city = input.city;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;
  if (input.bio !== undefined) patch.bio = input.bio;

  await updateProfile(userId, patch);

  const updated = await getMyProfile(userId);
  if (!updated) throw new Error('Profile update could not be verified.');
  return updated;
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
