"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isConfigured, supabase } from "./supabase";
import type { Profile } from "./types";

type AuthValue = {
  /** false until we know whether someone is signed in (and, if so, have loaded their profile) */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const NOT_CONFIGURED =
  "This console isn't connected to a database yet. Add the Supabase URL and publishable key to web/.env.local and restart.";

const fetchProfile = (userId: string) =>
  supabase().from("profiles").select("id, role, full_name, phone, specialty").eq("id", userId).maybeSingle();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    const { data } = supabase().auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecked(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void fetchProfile(userId).then(({ data, error }) => {
      if (!active) return;
      setProfile((data as Profile | null) ?? null);
      setProfileError(error ? error.message : data ? null : "Your account profile is missing.");
      setProfileFor(userId);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isConfigured) return NOT_CONFIGURED;
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    if (isConfigured) await supabase().auth.signOut();
  }, []);

  const ready = !isConfigured || (checked && (userId === null || profileFor === userId));
  const currentProfile = userId !== null && profileFor === userId ? profile : null;
  const error = !isConfigured ? NOT_CONFIGURED : userId !== null && profileFor === userId ? profileError : null;

  const value = useMemo(
    () => ({ ready, session, profile: currentProfile, error, signIn, signOut }),
    [ready, session, currentProfile, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
