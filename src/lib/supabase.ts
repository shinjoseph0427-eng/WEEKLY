// Supabase client — ported from web src/lib/supabaseClient.js with React Native
// adaptations (audit §4-A / §4 Supabase audit):
//   1. react-native-url-polyfill for URL support in Hermes
//   2. AsyncStorage adapter + persistSession/autoRefreshToken
//   3. detectSessionInUrl: false (RN has no URL-based session detection)
//   4. env access uses Expo public environment variables
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error('[WEEKLY] Missing EXPO_PUBLIC_SUPABASE_* env vars');

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Pause/resume token auto-refresh with app foreground state (Supabase RN docs
// pattern). Refreshing in the background wastes work and can race; this keeps
// the session fresh only while the app is active.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export default supabase;
