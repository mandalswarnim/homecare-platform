"use client";

import { LoaderCircle, LogOut, PlugZap, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import { isConfigured } from "@/lib/supabase";

import { BrandName } from "./brand";
import { Button } from "./ui";

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <BrandName />
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center">{children}</div>
    </div>
  );
}

/**
 * Only office admins get past this. It's a convenience for the UI — the real protection is
 * row-level security in the database, which returns nothing to accounts without the admin role.
 */
export function ConsoleGuard({ children }: { children: ReactNode }) {
  const { ready, session, profile, error, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && isConfigured && !session) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, session, router]);

  if (!isConfigured) {
    return (
      <Screen>
        <PlugZap className="mx-auto mb-3 size-6 text-muted" aria-hidden />
        <h1 className="text-base font-semibold text-ink">Not connected yet</h1>
        <p className="mt-2 text-sm text-muted">{error}</p>
      </Screen>
    );
  }

  if (!ready || !session) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-5 animate-spin" aria-hidden /> Opening the console…
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <Screen>
        <ShieldX className="mx-auto mb-3 size-6 text-critical-text" aria-hidden />
        <h1 className="text-base font-semibold text-ink">This console is for the office team</h1>
        <p className="mt-2 text-sm text-muted">
          {profile
            ? `You're signed in as ${session.user.email} (${roleLabel(profile.role).toLowerCase()} account). Patients and clinicians use the mobile app.`
            : (error ?? "We couldn't load your account.")}
        </p>
        <Button className="mt-5" icon={LogOut} onClick={() => void signOut()}>
          Sign out
        </Button>
      </Screen>
    );
  }

  return children;
}
