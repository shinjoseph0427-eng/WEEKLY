// Session context — ports the auth-bootstrap effect from web App.jsx:73-101
// (getSession on mount + onAuthStateChange) plus the profile load (App.jsx:103+)
// that decides onboarding completeness. Held in a small React context instead
// of the web app's component state; routing is gated on it in app/_layout.tsx.
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getMyProfile, isProfileOnboardingComplete } from '../features/profile/profile';
import type { Profile } from '../types/db';

interface SessionState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  onboardingComplete: boolean;
  authReady: boolean; // auth state resolved (session present or not)
  profileReady: boolean; // profile fetch resolved for the current user
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const currentUserId = useRef<string | null>(null);

  // Auth init: read the session directly on mount so authReady is set even if
  // INITIAL_SESSION never fires on a fresh first launch. onAuthStateChange then
  // keeps state in sync for later sign-in/out (mirrors web App.jsx:73-101).
  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!cancelled) setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setSession(s);
        setUser(s?.user ?? null);
        setAuthReady(true);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileReady(true);
        setOnboardingComplete(false);
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (uid: string) => {
    setProfileReady(false);
    const next = await getMyProfile(uid);
    // Ignore a stale resolve if the user changed mid-flight.
    if (currentUserId.current !== uid) return;
    setProfile(next);
    setOnboardingComplete(isProfileOnboardingComplete(next));
    setProfileReady(true);
  };

  // Load the profile whenever the signed-in user changes (mirrors App.jsx:103+).
  useEffect(() => {
    const uid = user?.id ?? null;
    currentUserId.current = uid;
    if (!uid) {
      setProfile(null);
      setOnboardingComplete(false);
      setProfileReady(true);
      return;
    }
    loadProfile(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        user,
        profile,
        onboardingComplete,
        authReady,
        profileReady,
        refreshProfile,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
