"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cx } from "../ui";
import { useWidth } from "./core";

export type Delta = { value: number; text: string; upIsGood: boolean; period: string };

/** Stat tile: label · value · delta vs a named period · optional sparkline or meter. */
export function StatTile({
  label,
  value,
  delta,
  note,
  children,
}: {
  label: string;
  value: ReactNode;
  delta?: Delta | null;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface px-4 pt-3.5 pb-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-ink">{value}</div>
      {delta ? <DeltaLine delta={delta} /> : null}
      {note ? <div className="mt-0.5 text-xs text-muted">{note}</div> : null}
      {children ? <div className="mt-auto pt-3">{children}</div> : null}
    </div>
  );
}

function DeltaLine({ delta }: { delta: Delta }) {
  const flat = delta.value === 0;
  const good = flat ? null : delta.value > 0 === delta.upIsGood;
  const Icon = flat ? Minus : delta.value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs">
      <span className={cx("inline-flex items-center gap-0.5 font-medium whitespace-nowrap", good === null ? "text-muted" : good ? "text-good-text" : "text-critical-text")}>
        <Icon className="size-3.5" aria-hidden />
        {delta.text}
      </span>
      <span className="text-muted">vs {delta.period}</span>
    </div>
  );
}

/** 2px line in the de-emphasis hue; the current (latest) point in the accent with a surface ring. */
export function Sparkline({ values, labels, format = String, height = 36 }: { values: number[]; labels: string[]; format?: (n: number) => string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = values.length;
  const max = Math.max(...values, 1);
  const pad = 5;
  const x = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
  const y = (v: number) => pad + (1 - v / max) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = n - 1;

  function pick(clientX: number, el: SVGSVGElement) {
    const rect = el.getBoundingClientRect();
    const rel = clientX - rect.left;
    const i = Math.round(((rel - pad) / Math.max(width - pad * 2, 1)) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Trend: ${labels[0]} ${format(values[0])} to ${labels[last]} ${format(values[last])}`}
          className="block overflow-visible"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setActive(null)}
        >
          <path d={d} fill="none" stroke="var(--deemph)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active !== null ? <line x1={x(active)} x2={x(active)} y1={0} y2={height} stroke="var(--axis)" strokeWidth={1} /> : null}
          {active !== null && active !== last ? (
            <circle cx={x(active)} cy={y(values[active])} r={4} fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={2} />
          ) : null}
          <circle cx={x(last)} cy={y(values[last])} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
        </svg>
      ) : null}
      {active !== null ? (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-md"
          style={{ left: Math.min(Math.max(x(active) - 40, 0), Math.max(width - 110, 0)) }}
        >
          <span className="font-semibold text-ink tabular-nums">{format(values[active])}</span> <span className="text-muted">{labels[active]}</span>
        </div>
      ) : null}
    </div>
  );
}

export type MeterLevel = "accent" | "warning" | "critical";

const METER: Record<MeterLevel, { fill: string; track: string }> = {
  accent: { fill: "var(--series-1)", track: "var(--series-1-track)" },
  warning: { fill: "var(--warning)", track: "var(--warning-soft)" },
  critical: { fill: "var(--critical)", track: "var(--critical-soft)" },
};

/** A single ratio against its limit; the track is a lighter step of the fill's own ramp. */
export function Meter({ value, level, label }: { value: number; level: MeterLevel; label: string }) {
  const m = METER[level];
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 w-full overflow-hidden rounded-full" style={{ background: m.track }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.fill }} />
    </div>
  );
}
