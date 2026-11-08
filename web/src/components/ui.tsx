"use client";

import { ChevronLeft, LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { initials } from "@/lib/format";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? <div className="mb-3">{back}</div> : null}
        <h1 className="text-[30px] text-ink sm:text-[34px]">{title}</h1>
        {subtitle ? <div className="mt-1.5 text-[15px] text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-1 inline-flex h-8 items-center gap-1 rounded-md pr-2 text-sm text-muted transition-colors hover:text-ink">
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-[14px] border border-line bg-surface shadow-panel", className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            {title ? <h2 className="text-[16px] font-semibold text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName ?? "px-6 pt-4 pb-6"}>{children}</div>
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover active:translate-y-px",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-3",
  danger: "border border-line-strong bg-surface text-critical-text hover:bg-critical-soft active:translate-y-px",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: LucideIcon; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-[9px] font-medium whitespace-nowrap transition-[background-color,color,transform] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
        VARIANT[variant],
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cx("inline-flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <select
        {...rest}
        className="h-9 rounded-[9px] border border-line-strong bg-surface px-3 pr-8 text-sm text-ink hover:bg-surface-2"
      >
        {children}
      </select>
    </label>
  );
}

export type Tone = "neutral" | "info" | "brand" | "good" | "warning" | "critical";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  info: "bg-info-soft text-info-text",
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good-text",
  warning: "bg-warning-soft text-warning-text",
  critical: "bg-critical-soft text-critical-text",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  lead,
  children,
  title,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  /** custom leading mark (e.g. a live dot) instead of an icon */
  lead?: ReactNode;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap", TONE[tone], className)}
    >
      {lead ?? (Icon ? <Icon className="size-3.5" aria-hidden /> : null)}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 32, className }: { name: string | null | undefined; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand", className)}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Icon className="size-6 text-faint" aria-hidden strokeWidth={1.6} />
      <p className="mt-1 text-[15px] font-medium text-ink">{title}</p>
      {body ? <p className="max-w-sm text-[13px] text-muted">{body}</p> : null}
      {children}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-critical-soft px-5 py-3.5 text-sm text-critical-text">
      <span>{message}</span>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Label/value pair for detail panels. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

/** A row of mutually exclusive presets (date ranges etc.). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] bg-surface-3 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-8 rounded-[7px] px-3.5 text-[13px] font-medium transition-colors",
              on ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A row of short facts (date, phone, address…), spaced apart instead of joined with dots. */
export function Meta({ parts, className }: { parts: ReactNode[]; className?: string }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  if (shown.length === 0) return null;
  return (
    <span className={cx("flex flex-wrap gap-x-3 gap-y-0.5", className)}>
      {shown.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </span>
  );
}

/** The empty-cell marker: a short drawn rule (not a dash in the copy), read out as "None". */
export function Nil() {
  return <span role="img" aria-label="None" className="inline-block h-px w-3 bg-axis align-middle" />;
}
