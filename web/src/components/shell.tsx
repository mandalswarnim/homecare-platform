"use client";

import { ClipboardList, LayoutDashboard, LogOut, Monitor, Moon, Stethoscope, Sun, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { formatTime, timeAgo } from "@/lib/format";
import { useNow } from "@/lib/live";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";

import { BrandName } from "./brand";
import { useConsole } from "./console-data";
import { Avatar, cx } from "./ui";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/visits", label: "Visits", icon: ClipboardList },
  { href: "/patients", label: "Patients", icon: UsersRound },
  { href: "/team", label: "Team", icon: Stethoscope },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, layout }: { pathname: string | null; layout: "side" | "top" }) {
  return (
    <nav aria-label="Main" className={layout === "side" ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto"}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "flex h-9 items-center gap-3 rounded-[9px] px-3 text-[14px] font-medium whitespace-nowrap transition-colors",
              on ? "bg-surface text-ink shadow-panel" : "text-ink-2 hover:bg-surface-3/60 hover:text-ink",
            )}
          >
            <Icon className={cx("size-4", on ? "text-brand" : "text-muted")} aria-hidden strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNav({ layout }: { layout: "side" | "top" }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} layout={layout} />;
}

function Nav({ layout }: { layout: "side" | "top" }) {
  return (
    <Suspense fallback={<NavLinks pathname={null} layout={layout} />}>
      <ActiveNav layout={layout} />
    </Suspense>
  );
}

function LiveStatus() {
  const { live, updatedAt, error } = useConsole();
  const now = useNow(15_000);
  const ago = updatedAt ? timeAgo(new Date(updatedAt).toISOString(), now) : "";
  if (error && updatedAt)
    return (
      <span className="inline-flex items-center gap-2 text-xs text-warning-text" title={error}>
        <span aria-hidden className="size-2 rounded-full bg-warning" /> Reconnecting, showing data from {formatTime(new Date(updatedAt).toISOString())}
      </span>
    );
  return live ? (
    <span className="inline-flex items-center gap-2 text-xs text-ink-2">
      <span className="live-dot" aria-hidden /> Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span aria-hidden className="size-2 rounded-full bg-axis" /> {updatedAt ? `Updated ${ago}` : "Connecting…"}
    </span>
  );
}

function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readTheme());
  const options: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
    { value: "system", label: "Match system", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-[9px] bg-surface-3/70 p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => {
            setChoice(value);
            applyTheme(value);
          }}
          className={cx(
            "flex size-7 items-center justify-center rounded-[7px] transition-colors",
            choice === value ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function UserBlock({ compact }: { compact?: boolean }) {
  const { profile, session, signOut } = useAuth();
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={profile?.full_name || session?.user.email} size={30} />
      {!compact ? (
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-ink">{profile?.full_name || "Admin"}</div>
          <div className="truncate text-xs text-muted">{session?.user.email}</div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex size-8 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-surface-3/60 hover:text-ink"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-64 flex-col border-r border-line bg-rail px-4 py-6 lg:flex">
        <div className="px-2 pb-8">
          <BrandName />
        </div>
        <Nav layout="side" />
        <div className="mt-auto space-y-5 px-2">
          <div className="flex items-center justify-between gap-3">
            <LiveStatus />
            <ThemeToggle />
          </div>
          <div className="border-t border-line pt-5">
            <UserBlock />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-[1100] border-b border-line bg-rail/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <BrandName />
          <div className="flex items-center gap-3">
            <LiveStatus />
            <UserBlock compact />
          </div>
        </div>
        <div className="px-2 pb-2">
          <Nav layout="top" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
