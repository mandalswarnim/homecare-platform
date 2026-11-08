"use client";

import {
  Ban,
  CalendarCheck,
  CircleCheck,
  CircleX,
  CloudOff,
  Hourglass,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { Severity } from "@/lib/attention";
import type { VisitStatus } from "@/lib/types";
import { flagText, STATUS_LABEL, type Verification } from "@/lib/visits";

import { Badge, cx, Nil, type Tone } from "./ui";

const STATUS_STYLE: Record<VisitStatus, { tone: Tone; icon?: LucideIcon }> = {
  requested: { tone: "info", icon: Hourglass },
  accepted: { tone: "brand", icon: CalendarCheck },
  in_progress: { tone: "good" },
  completed: { tone: "neutral", icon: CircleCheck },
  declined: { tone: "critical", icon: CircleX },
  cancelled: { tone: "neutral", icon: Ban },
};

export function StatusBadge({ status }: { status: VisitStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <Badge tone={s.tone} icon={s.icon} lead={status === "in_progress" ? <span className="live-dot mr-0.5" aria-hidden /> : undefined}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function VerificationBadge({ value, flags = [] }: { value: Verification; flags?: string[] }) {
  if (value === "none") return <Nil />;
  if (value === "verified")
    return (
      <Badge tone="good" icon={ShieldCheck} title="Clock-in and clock-out were inside the patient's home area">
        Verified
      </Badge>
    );
  if (value === "pending")
    return (
      <Badge tone="neutral" icon={CloudOff} title="Waiting for the clinician's phone to sync">
        Awaiting sync
      </Badge>
    );
  return (
    <Badge tone="warning" icon={ShieldAlert} title={flags.map(flagText).join(", ") || "Needs review"}>
      Needs review
    </Badge>
  );
}

export const SEVERITY: Record<Severity, { label: string; icon: LucideIcon; text: string; bg: string }> = {
  critical: { label: "Urgent", icon: OctagonAlert, text: "text-critical-text", bg: "bg-critical-soft" },
  serious: { label: "Act today", icon: TriangleAlert, text: "text-serious-text", bg: "bg-serious-soft" },
  warning: { label: "Check", icon: TriangleAlert, text: "text-warning-text", bg: "bg-warning-soft" },
};

/** Severity chip: icon + label, never colour alone. */
export function SeverityTag({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <span className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold", s.bg, s.text, className)}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}

export function FlagList({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <li key={f}>
          <Badge tone="warning" icon={TriangleAlert}>
            {flagText(f)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
