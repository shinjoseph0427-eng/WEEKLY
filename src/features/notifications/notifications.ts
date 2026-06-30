// Notifications — CRUD + realtime + push trigger.
// Ported from web src/lib/notifications.js (KEEP). Env access swapped to
// EXPO_PUBLIC_*. sendPushForNotification is left as-is: it calls the existing
// Edge Function and will no-op until native push is wired in a later phase.
// Push transport integration is intentionally deferred.
import { supabase } from '../../lib/supabase';
import type { AppNotification } from '../../types/db';

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markAsRead(notificationId: string): Promise<{ id: string }> {
  if (!notificationId) throw new Error('Notification id is required');

  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Notification could not be marked read');
  return data[0];
}

export async function markAllAsRead(userId: string): Promise<{ id: string }[]> {
  if (!userId) throw new Error('User id is required');

  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
    .select('id');
  if (error) throw error;
  return data ?? [];
}

// currentUserId must match userId — guards against cross-user subscriptions.
export function subscribeNotifications(
  userId: string,
  currentUserId: string,
  callback: (n: AppNotification) => void,
): () => void {
  if (!userId || userId !== currentUserId) return () => {};

  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const channelId =
    cryptoRef?.randomUUID
      ? cryptoRef.randomUUID()
      : `${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const channel = supabase
    .channel(`notif:${userId}:${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => callback(payload.new as AppNotification),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function sendPushForNotification(notificationId: string): Promise<void> {
  try {
    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ notificationId }),
    });
  } catch (e) {
    console.warn('Push notification error:', e);
  }
}

// Per-type lifetime (ms) before a notification is auto-deleted by the DB
// cleanup job. Defaults to 30 days for any unlisted type.
const NOTIFICATION_TTL_MS: Record<string, number> = {
  match: 30 * 24 * 60 * 60 * 1000, // 30 days
};
const DEFAULT_NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function notificationExpiresAt(type: string): string {
  const ttl = NOTIFICATION_TTL_MS[type] ?? DEFAULT_NOTIFICATION_TTL_MS;
  return new Date(Date.now() + ttl).toISOString();
}

export async function createNotificationForUser(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<{ user_id: string; type: string; payload: Record<string, unknown> }> {
  // No .select()/.single() here: the row's user_id is usually NOT auth.uid()
  // (we notify another user), and the notifications SELECT RLS policy
  // (user_id = auth.uid()) would filter the RETURNING row out, making .single()
  // throw on 0 rows. INSERT itself is allowed (WITH CHECK true), so we just
  // insert and check the error.
  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, payload, expires_at: notificationExpiresAt(type) });
  if (error) throw error;

  return { user_id: userId, type, payload };
}

export async function createNotificationsForDuo(
  duoId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: members, error: membersError } = await supabase
    .from('duo_members')
    .select('user_id')
    .eq('duo_id', duoId);
  if (membersError) throw membersError;
  if (!members?.length) return;

  const { data: inserted, error } = await supabase
    .from('notifications')
    .insert(
      members.map((m: { user_id: string }) => ({
        user_id: m.user_id,
        type,
        payload,
        read: false,
        expires_at: notificationExpiresAt(type),
      })),
    )
    .select('id');
  if (error) throw error;

  // Fire a push for each recipient (no-op for types the edge function skips).
  // Best-effort: never let a push failure break notification creation.
  await Promise.all(
    (inserted ?? []).map((n: { id: string }) => sendPushForNotification(n.id).catch(() => {})),
  );
}
