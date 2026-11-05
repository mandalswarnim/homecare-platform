"use client";

import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { BrandName } from "@/components/brand";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import { isConfigured } from "@/lib/supabase";

/** Only same-site paths, so a crafted ?next= can't bounce people to another site. */
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

export function LoginView() {
  const { ready, session, profile, error: authError, signIn, signOut } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = ready && session && profile?.role === "admin";
  useEffect(() => {
    if (isAdmin) router.replace(nextPath());
  }, [isAdmin, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err === "Invalid login credentials" ? "That email and password don't match an account." : err);
  }

  const wrongRole = ready && session && profile && profile.role !== "admin";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandName />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          {wrongRole ? (
            <div className="text-center">
              <h1 className="text-base font-semibold text-ink">This console is for the office team</h1>
              <p className="mt-2 text-sm text-muted">
                {session.user.email} is a {roleLabel(profile.role).toLowerCase()} account. Patients and clinicians use the mobile app.
              </p>
              <Button className="mt-5" icon={LogOut} onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-ink">Sign in</h1>
                <p className="mt-1 text-sm text-muted">Office admins only.</p>
              </div>
              {!isConfigured ? <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning-text">{authError}</p> : null}
              <label className="block">
                <span className="text-[13px] font-medium text-ink">Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium text-ink">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
                />
              </label>
              {error ? (
                <p role="alert" className="text-[13px] text-critical-text">
                  {error}
                </p>
              ) : null}
              <Button type="submit" variant="primary" icon={LogIn} loading={busy || Boolean(isAdmin)} disabled={!isConfigured} className="h-10 w-full">
                Sign in
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
