"use client";

import { useState } from "react";

import { formatInt } from "@/lib/format";
import type { Ranked } from "@/lib/metrics";

/**
 * Ranked horizontal bars, largest first, one hue (comparing parts of a whole). Value at the tip,
 * 4px rounded data end, square at the baseline. Each row is a hover/focus target.
 */
export function RankedBars({
  items,
  color = "var(--series-1)",
  format = formatInt,
  unit,
  max: maxRows = 8,
}: {
  items: Ranked[];
  color?: string;
  format?: (n: number) => string;
  unit?: string;
  max?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = items.reduce((s, it) => s + it.value, 0);
  const shown = items.slice(0, maxRows);
  const rest = items.slice(maxRows);
  const rows = rest.length ? [...shown, { key: "__other", label: `Other (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0) }] : shown;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-2.5" onPointerLeave={() => setActive(null)}>
      {rows.map((r) => {
        const pct = r.value / max;
        const share = total ? Math.round((r.value / total) * 100) : 0;
        const on = active === r.key;
        return (
          <li
            key={r.key}
            tabIndex={0}
            aria-label={`${r.label}: ${format(r.value)}${unit ? ` ${unit}` : ""}, ${share}% of total`}
            onPointerEnter={() => setActive(r.key)}
            onFocus={() => setActive(r.key)}
            onBlur={() => setActive(null)}
            className="relative -mx-2 rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand"
            style={{ background: on ? "var(--surface-2)" : undefined }}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate text-ink">{r.label}</span>
              {r.detail ? <span className="shrink-0 text-xs text-muted">{r.detail}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 min-w-0 flex-1">
                <div
                  className="h-full"
                  style={{ width: `${Math.max(pct * 100, r.value > 0 ? 1.5 : 0)}%`, background: color, borderRadius: "0 4px 4px 0" }}
                />
              </div>
              <span className="min-w-10 shrink-0 text-right text-[13px] font-medium whitespace-nowrap text-ink tabular-nums">{format(r.value)}</span>
            </div>
            {on ? (
              <div className="pointer-events-none absolute top-0 right-14 z-10 -translate-y-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs shadow-lg">
                <span className="font-semibold text-ink tabular-nums">{share}%</span> <span className="text-muted">of the total</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
