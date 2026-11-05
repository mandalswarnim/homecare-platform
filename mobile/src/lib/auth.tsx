import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  /** true until we know whether someone is signed in (and, if so, have loaded their profile) */
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const fetchProfile = (userId: string) =>
  supabase.from('profiles').select('id, role, full_name, phone, specialty').eq('id', userId).maybeSingle();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecked(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const applyProfile = useCallback((forUser: string, data: unknown, error: { message: string } | null) => {
    setProfile((data as Profile | null) ?? null);
    setProfileError(error ? error.message : data ? null : 'Your account profile is missing.');
    setProfileFor(forUser);
  }, []);

  // Load the profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void fetchProfile(userId).then(({ data, error }) => {
      if (active) applyProfile(userId, data, error);
    });
    return () => {
      active = false;
    };
  }, [userId, applyProfile]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await fetchProfile(userId);
    applyProfile(userId, data, error);
  }, [userId, applyProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileFor(null);
  }, []);

  const loading = !checked || (userId !== null && profileFor !== userId);
  const currentProfile = userId !== null && profileFor === userId ? profile : null;

  const value = useMemo(
    () => ({ session, profile: currentProfile, loading, profileError, refreshProfile, signOut }),
    [session, currentProfile, loading, profileError, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
