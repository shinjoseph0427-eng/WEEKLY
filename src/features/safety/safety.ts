// Block / report / sanctions — ported from web src/lib/safety.js (KEEP).
// Feeds App Store safety requirements + the v1 blocked-users management screen.
// Behavior unchanged. The duo-level helpers (blocks/reports/duo_sanctions) are
// carried over verbatim per the locked decision; the app builds no duo UI.
import { supabase } from '../../lib/supabase';
import type { DuoSanction } from '../../types/db';

const DUPLICATE_REPORT_MESSAGE = 'You already reported this duo for this reason.';
const RESTRICTED_DUO_MESSAGE = 'This duo is not available right now.';
const RESTRICTED_OWN_DUO_MESSAGE = 'This duo cannot create new plans right now.';

type PgError = { code?: string; message?: string } | null | undefined;

const COUNTABLE_REPORT_REASONS = new Set([
  'unsafe',
  'disrespectful',
  'harassment',
  'fake_profile',
  'fake profile',
  'other',
]);

function normalizeReason(reason: string | null | undefined): string {
  return String(reason ?? '').trim().toLowerCase();
}

function isDuplicateReportError(error: PgError): boolean {
  return error?.code === '23505' || !!error?.message?.toLowerCase().includes('duplicate');
}

function isMissingDetailColumnError(error: PgError): boolean {
  return (
    !!error?.message?.toLowerCase().includes("'detail' column") ||
    !!error?.message?.toLowerCase().includes('column "detail"')
  );
}

export function isCountableSafetyReason(reason: string): boolean {
  const normalized = normalizeReason(reason);
  if (normalized === 'not a fit' || normalized === 'not_a_fit') return false;
  return COUNTABLE_REPORT_REASONS.has(normalized);
}

export function isRestrictedDuoError(error: PgError): boolean {
  return error?.message === RESTRICTED_DUO_MESSAGE;
}

export interface ReportDuoArgs {
  reporterUserId: string;
  reportedDuoId: string;
  reason: string;
  detail?: string | null;
}

export async function reportDuo({
  reporterUserId,
  reportedDuoId,
  reason,
  detail,
}: ReportDuoArgs): Promise<{ report: null; sanction: DuoSanction | null }> {
  if (!reporterUserId || !reportedDuoId || !reason)
    throw new Error('Missing required report fields');

  const { data: membership } = await supabase
    .from('duo_members')
    .select('duo_id')
    .eq('duo_id', reportedDuoId)
    .eq('user_id', reporterUserId)
    .maybeSingle();

  if (membership) throw new Error('You cannot report your own duo.');

  const { data: existingReport } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_user_id', reporterUserId)
    .eq('reported_duo_id', reportedDuoId)
    .eq('reason', reason)
    .maybeSingle();

  if (existingReport) throw new Error(DUPLICATE_REPORT_MESSAGE);

  const reportPayload = {
    reporter_user_id: reporterUserId,
    reported_duo_id: reportedDuoId,
    reason,
    detail: detail || null,
  };
  let { error } = await supabase.from('reports').insert(reportPayload);

  if (isMissingDetailColumnError(error)) {
    const { detail: _detail, ...fallbackPayload } = reportPayload;
    const retry = await supabase
      .from('reports')
      .insert({ ...fallbackPayload, details: detail || null });
    error = retry.error;
  }

  if (isDuplicateReportError(error)) throw new Error(DUPLICATE_REPORT_MESSAGE);
  if (error) throw error;

  const sanction = await evaluateDuoSanction(reportedDuoId, reason).catch(() => null);
  return { report: null, sanction };
}

export interface ReportUserArgs {
  reporterUserId: string;
  reportedUserId: string;
  reason: string;
  detail?: string | null;
}

export async function reportUser({
  reporterUserId,
  reportedUserId,
  reason,
  detail,
}: ReportUserArgs): Promise<{ report: null }> {
  if (!reporterUserId || !reportedUserId || !reason)
    throw new Error('Missing required report fields');
  if (reporterUserId === reportedUserId) throw new Error('You cannot report yourself.');

  const { data: existingReport } = await supabase
    .from('user_reports')
    .select('id')
    .eq('reporter_user_id', reporterUserId)
    .eq('reported_user_id', reportedUserId)
    .eq('reason', reason)
    .maybeSingle();

  if (existingReport) throw new Error(DUPLICATE_REPORT_MESSAGE);

  const { error } = await supabase.from('user_reports').insert({
    reporter_user_id: reporterUserId,
    reported_user_id: reportedUserId,
    reason,
    detail: detail || null,
  });

  if (isDuplicateReportError(error)) throw new Error(DUPLICATE_REPORT_MESSAGE);
  if (error) throw error;

  return { report: null };
}

export async function blockDuo({
  blockerDuoId,
  blockedDuoId,
}: {
  blockerDuoId: string;
  blockedDuoId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .upsert(
      { blocker_duo_id: blockerDuoId, blocked_duo_id: blockedDuoId },
      { onConflict: 'blocker_duo_id,blocked_duo_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unblockDuo({
  blockerDuoId,
  blockedDuoId,
}: {
  blockerDuoId: string;
  blockedDuoId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_duo_id', blockerDuoId)
    .eq('blocked_duo_id', blockedDuoId);
  if (error) throw error;
}

export async function getBlockedDuoIds(myDuoId: string | string[]): Promise<string[]> {
  const duoIds = Array.isArray(myDuoId) ? myDuoId.filter(Boolean) : [myDuoId].filter(Boolean);
  if (duoIds.length === 0) return [];

  const { data } = await supabase
    .from('blocks')
    .select('blocked_duo_id')
    .in('blocker_duo_id', duoIds);
  return (data ?? []).map((r: { blocked_duo_id: string }) => r.blocked_duo_id);
}

export async function evaluateDuoSanction(
  reportedDuoId: string,
  reason: string,
): Promise<DuoSanction | null> {
  if (!reportedDuoId || !reason || !isCountableSafetyReason(reason)) return null;

  const { data: reports, error } = await supabase
    .from('reports')
    .select('reporter_user_id')
    .eq('reported_duo_id', reportedDuoId)
    .eq('reason', reason);

  if (error) {
    const { data: evaluated, error: rpcError } = await supabase.rpc('evaluate_duo_sanction', {
      p_duo_id: reportedDuoId,
      p_reason: reason,
    });
    if (rpcError) throw error;
    return evaluated
      ? { duo_id: reportedDuoId, reason, sanction_type: 'restricted', status: 'active' }
      : null;
  }

  const uniqueReporterIds = new Set(
    (reports ?? []).map((r: { reporter_user_id: string }) => r.reporter_user_id).filter(Boolean),
  );
  const reportCount = uniqueReporterIds.size;
  if (reportCount < 3) {
    const { data: evaluated } = await supabase.rpc('evaluate_duo_sanction', {
      p_duo_id: reportedDuoId,
      p_reason: reason,
    });
    return evaluated
      ? { duo_id: reportedDuoId, reason, sanction_type: 'restricted', status: 'active' }
      : null;
  }

  const { data: existing } = await supabase
    .from('duo_sanctions')
    .select('id, duo_id, reason, sanction_type, status')
    .eq('duo_id', reportedDuoId)
    .eq('reason', reason)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) return existing as DuoSanction;

  const { error: insertError } = await supabase.from('duo_sanctions').insert({
    duo_id: reportedDuoId,
    reason,
    sanction_type: 'restricted',
    status: 'active',
    report_count: reportCount,
  });

  if (insertError?.code === '23505') {
    const { data: duplicate } = await supabase
      .from('duo_sanctions')
      .select('id, duo_id, reason, sanction_type, status')
      .eq('duo_id', reportedDuoId)
      .eq('reason', reason)
      .eq('status', 'active')
      .maybeSingle();
    return (duplicate as DuoSanction) ?? null;
  }
  if (insertError) throw insertError;
  return { duo_id: reportedDuoId, reason, sanction_type: 'restricted', status: 'active' };
}

export async function getActiveSanctionsForDuo(duoId: string): Promise<DuoSanction[]> {
  if (!duoId) return [];
  const { data, error } = await supabase
    .from('duo_sanctions')
    .select('id, duo_id, reason, sanction_type, status')
    .eq('duo_id', duoId)
    .eq('status', 'active');

  if (error) return [];
  return (data as DuoSanction[]) ?? [];
}

export async function isDuoRestricted(duoId: string): Promise<boolean> {
  if (!duoId) return false;
  const { data, error } = await supabase.rpc('is_duo_restricted', { p_duo_id: duoId });
  if (!error) return !!data;

  const sanctions = await getActiveSanctionsForDuo(duoId);
  return sanctions.some((s) => s.sanction_type === 'restricted');
}

export async function assertDuoIsNotRestricted(duoId: string): Promise<void> {
  if (await isDuoRestricted(duoId)) throw new Error(RESTRICTED_DUO_MESSAGE);
}

export async function getRestrictedDuoIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_restricted_duo_ids_for_explore');
  if (error) return [];
  return (data ?? [])
    .map((r: { duo_id: string }) => r.duo_id)
    .filter(Boolean);
}

async function getBlockedUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id).filter(Boolean);
}

export async function blockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (!blockerUserId || !blockedUserId) throw new Error('Missing user IDs');
  const { error } = await supabase
    .from('user_blocks')
    .upsert(
      { blocker_id: blockerUserId, blocked_id: blockedUserId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function getHiddenUserIds(
  myDuoIds: string | string[],
  currentUserId: string,
): Promise<Set<string>> {
  const duoIds = Array.isArray(myDuoIds) ? myDuoIds.filter(Boolean) : [myDuoIds].filter(Boolean);
  const [blockedDuoIds, restrictedDuoIds, userBlockedIds] = await Promise.all([
    getBlockedDuoIds(duoIds),
    getRestrictedDuoIds(),
    getBlockedUserIds(currentUserId),
  ]);
  const allDuoIds = [...new Set([...blockedDuoIds, ...restrictedDuoIds])].filter(Boolean);
  const hiddenIds = new Set(userBlockedIds);
  if (allDuoIds.length === 0) return hiddenIds;
  const { data } = await supabase.from('duo_members').select('user_id').in('duo_id', allDuoIds);
  (data ?? []).forEach((r: { user_id: string }) => {
    if (r.user_id) hiddenIds.add(r.user_id);
  });
  return hiddenIds;
}

export const SAFETY_MESSAGES = {
  duplicateReport: DUPLICATE_REPORT_MESSAGE,
  restrictedDuo: RESTRICTED_DUO_MESSAGE,
  restrictedOwnDuo: RESTRICTED_OWN_DUO_MESSAGE,
} as const;
