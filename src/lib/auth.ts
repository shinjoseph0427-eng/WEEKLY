// Auth — rewritten for the app's OAuth-only model.
// KEPT from web src/lib/auth.js: signOut, getUser, deleteAccount.
// DROPPED: signUp / signIn (email/password — removed in v1).
// NEW: signInWithApple (expo-apple-authentication) and signInWithGoogle
// (@react-native-google-signin/google-signin, NATIVE). Both exchange the
// provider id-token with Supabase via signInWithIdToken. Profile rows are NOT
// created here — the auth.users INSERT trigger (Phase 1 migration) seeds them.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────
// Google one-time configuration (module load).
// webClientId is REQUIRED even on iOS — Supabase validates the id-token
// audience against it during the signInWithIdToken exchange.
// ─────────────────────────────────────────────────────────
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

// ─────────────────────────────────────────────────────────
// Apple Sign In
// ─────────────────────────────────────────────────────────

/** Thrown (or used to detect) a user-cancelled native sign-in sheet. */
export const AUTH_CANCELLED = 'AUTH_CANCELLED';

export async function signInWithApple(): Promise<User | null> {
  // Pair a raw nonce (sent to Supabase) with its SHA-256 hash (sent to Apple).
  // Apple embeds the hash in the identityToken; Supabase re-hashes the raw
  // nonce and compares — this binds the token to this request (replay defense).
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      throw new Error(AUTH_CANCELLED);
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In failed: no identity token returned.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  return data.user;
}

// ─────────────────────────────────────────────────────────
// Google Sign In (native)
// ─────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User | null> {
  await GoogleSignin.hasPlayServices();

  let idToken: string | null;
  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      // type === 'cancelled'
      throw new Error(AUTH_CANCELLED);
    }
    idToken = response.data.idToken;
  } catch (e) {
    if ((e as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error(AUTH_CANCELLED);
    }
    throw e;
  }

  if (!idToken) {
    throw new Error('Google Sign-In failed: no id token returned.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data.user;
}

// ─────────────────────────────────────────────────────────
// KEPT from web auth.js
// ─────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  // Best-effort native Google sign-out so the next sign-in shows the chooser.
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore — user may not have signed in with Google
  }
  await supabase.auth.signOut();
}

// Soft-deletes the current user's account (sets profiles.deleted_at via a
// SECURITY DEFINER RPC) and signs out locally. The SIGNED_OUT auth event then
// routes the app back to the sign-in screen.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_user_account');
  if (error) throw error;
  await signOut();
}

export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
