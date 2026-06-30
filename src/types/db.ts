// Shared database row types for the tables the ported lib layer touches.
// Shapes are derived from the web select strings and the migrations in
// DUO OC/supabase/migrations/. Nullable columns reflect the SQL schema.
//
// Scope note: blocks / reports / duo_sanctions exist only because safety.js is
// ported verbatim (locked decision: blocked-users mgmt logic ships in v1). The
// app does not build duo features on top of them.

export type ISODateString = string;
export type UUID = string;

// ── profiles ────────────────────────────────────────────────────────────────
export interface Profile {
  id: UUID;
  username: string | null;
  name: string | null;
  photos: string[] | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  instagram: string | null;
  bio: string | null;
  is_solo: boolean;
  onboarding_complete: boolean | null;
  birth_year: number | null;
  age: number | null;
  fcm_token: string | null;
  deleted_at: ISODateString | null;
  created_at: ISODateString;
}

// Subset selected by solo.js PROFILE_FIELDS (discovery / match partner cards).
export type SoloProfile = Pick<
  Profile,
  'id' | 'username' | 'name' | 'photos' | 'city' | 'lat' | 'lng' | 'instagram' | 'bio' | 'is_solo'
>;

// Subset selected by soloMessages.js SENDER_FIELDS / plan guest rows.
export type SenderProfile = Pick<Profile, 'id' | 'username' | 'name' | 'photos'>;
export type GuestProfile = Pick<Profile, 'id' | 'username' | 'name' | 'photos' | 'city'>;

// Discovery result: a SoloProfile annotated with computed distance.
export type SoloDiscoveryUser = SoloProfile & { distanceKm: number | null };

// ── solo_requests ─────────────────────────────────────────────────────────
export type SoloRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface SoloRequest {
  id: UUID;
  from_user_id: UUID;
  to_user_id: UUID;
  status: SoloRequestStatus;
  created_at: ISODateString;
}

export interface SoloRequestWithTo {
  id: UUID;
  status: SoloRequestStatus;
  created_at: ISODateString;
  to_user: SoloProfile | null;
}

export interface SoloRequestWithFrom {
  id: UUID;
  status: SoloRequestStatus;
  created_at: ISODateString;
  from_user: SoloProfile | null;
}

// ── solo_matches ──────────────────────────────────────────────────────────────
export type SoloMatchStatus = 'active' | 'ended';

export interface SoloMatch {
  id: UUID;
  user_a: UUID;
  user_b: UUID;
  status: SoloMatchStatus;
  matched_at: ISODateString;
  ended_at: ISODateString | null;
  created_at: ISODateString;
}

// Shape returned by getMySoloMatches() after mapping to the partner profile.
export interface SoloMatchSummary {
  matchId: UUID;
  status: SoloMatchStatus;
  matchedAt: ISODateString;
  partner: SoloProfile | null | undefined;
}

// ── solo_messages ─────────────────────────────────────────────────────────────
export interface SoloMessage {
  id: UUID;
  match_id: UUID;
  sender_user_id: UUID | null;
  content: string;
  is_system: boolean | null;
  created_at: ISODateString;
  sender?: SenderProfile | null;
}

// ── solo_match_reads ──────────────────────────────────────────────────────────
export interface SoloMatchRead {
  match_id: UUID;
  user_id: UUID;
  last_read_at: ISODateString;
}

// ── solo_chat_deletions ───────────────────────────────────────────────────────
export interface SoloChatDeletion {
  id?: UUID;
  match_id: UUID;
  user_id: UUID;
  created_at?: ISODateString;
}

// ── solo_plans ────────────────────────────────────────────────────────────────
export type SoloPlanStatus = 'proposed' | 'confirmed' | 'cancelled';

export interface SoloPlan {
  id: UUID;
  match_id: UUID;
  proposed_by: UUID;
  status: SoloPlanStatus;
  day: string;
  time_label: string;
  place: string | null;
  activity: string | null;
  place_lat: number | null;
  place_lng: number | null;
  place_type: string | null;
  google_place_id: string | null;
  confirmed_by: UUID | null;
  confirmed_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface ProposeSoloPlanFields {
  day: string;
  time_label: string;
  place?: string | null;
  activity?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  place_type?: string | null;
  google_place_id?: string | null;
}

// ── solo_plan_guests ──────────────────────────────────────────────────────────
export type SoloPlanGuestStatus = 'invited' | 'accepted' | 'declined';

export interface SoloPlanGuest {
  id: UUID;
  plan_id: UUID;
  invited_by: UUID;
  guest_user_id: UUID;
  status: SoloPlanGuestStatus;
  created_at: ISODateString;
  updated_at: ISODateString;
  responded_at: ISODateString | null;
  guest: GuestProfile | null;
  inviter: GuestProfile | null;
}

// ── weekly_cards ──────────────────────────────────────────────────────────────
export type WeeklyCardStatus = 'open' | 'matched' | 'expired';

export interface WeeklyCard {
  id: UUID;
  user_id: UUID;
  week_start: string; // 'YYYY-MM-DD'
  days: string[];
  time_slots: string[];
  place: string | null;
  place_lat: number | null;
  place_lng: number | null;
  vibe: string | null;
  status: WeeklyCardStatus;
  created_at: ISODateString;
}

export interface WeeklyCardInput {
  days?: string[];
  time_slots?: string[];
  place?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  vibe?: string | null;
  status?: WeeklyCardStatus;
}

// Row shape returned by the find_weekly_matches RPC.
export interface WeeklyMatch {
  id: UUID;
  username: string | null;
  name: string | null;
  photos: string[] | null;
  city: string | null;
  bio: string | null;
  instagram: string | null;
  lat: number | null;
  lng: number | null;
  overlap_days: string[];
  overlap_slots: string[];
  distance_km: number | null;
}

// ── notifications ─────────────────────────────────────────────────────────────
export interface AppNotification {
  id: UUID;
  user_id: UUID;
  type: string;
  payload: Record<string, unknown> | null;
  read: boolean;
  expires_at: ISODateString | null;
  created_at: ISODateString;
}

// ── user_blocks ───────────────────────────────────────────────────────────────
export interface UserBlock {
  blocker_id: UUID;
  blocked_id: UUID;
  created_at?: ISODateString;
}

// ── user_reports ──────────────────────────────────────────────────────────────
export interface UserReport {
  id: UUID;
  reporter_user_id: UUID;
  reported_user_id: UUID;
  reason: string;
  detail: string | null;
  created_at?: ISODateString;
}

// ── blocks (duo-level, legacy; used only by ported safety.js) ─────────────────
export interface DuoBlock {
  blocker_duo_id: UUID;
  blocked_duo_id: UUID;
  created_at?: ISODateString;
}

// ── reports (duo-level, legacy; used only by ported safety.js) ────────────────
export interface DuoReport {
  id: UUID;
  reporter_user_id: UUID;
  reported_duo_id: UUID;
  reason: string;
  detail?: string | null;
  details?: string | null;
  created_at?: ISODateString;
}

// ── duo_sanctions (legacy; used only by ported safety.js) ─────────────────────
export interface DuoSanction {
  id?: UUID;
  duo_id: UUID;
  reason: string;
  sanction_type: string;
  status: string;
  report_count?: number;
}
