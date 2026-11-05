"use client";

import { useState } from "react";

import { niceTicks, Tooltip, useWidth } from "./core";

export type ColumnSeries = { key: string; label: string; color: string };
export type ColumnDatum = { key: string; axisLabel: string; title: string; values: number[] };

const M = { top: 18, right: 4, bottom: 24, left: 30 };
const GAP = 2; // surface gap between stacked segments
const R = 4; // rounded data end

/** Top-rounded rect path (square at the baseline). */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Stacked columns over days (part-to-whole over time). Thin marks (<=24px), 2px surface gap
 * between segments, 4px rounded data end, hairline grid. Each day is a hover/focus target.
 */
export function StackedColumns({
  series,
  data,
  height = 220,
  ariaLabel,
}: {
  series: ColumnSeries[];
  data: ColumnDatum[];
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const ticks = niceTicks(Math.max(...totals, 1), 4);
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const n = Math.max(data.length, 1);
  const band = plotW / n;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const cx = (i: number) => M.left + band * (i + 0.5);
  const labelEvery = Math.max(1, Math.ceil(44 / Math.max(band, 1)));
  const peak = totals.reduce((best, t, i) => (t > totals[best] ? i : best), 0);

  return (
    <div ref={ref} className="relative w-full" style={{ height }} onPointerLeave={() => setActive(null)}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${ariaLabel}. Use the arrow keys to read each day.`}
          tabIndex={0}
          className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onFocus={() => setActive((a) => a ?? data.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? data.length) - 1));
            if (e.key === "ArrowRight") setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
          }}
        >
          {/* grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[11px] tabular-nums">
                {t}
              </text>
            </g>
          ))}

          {active !== null ? (
            <rect x={M.left + band * active} y={M.top} width={band} height={plotH} fill="var(--surface-2)" />
          ) : null}

          {/* columns */}
          {data.map((d, i) => {
            const x = cx(i) - barW / 2;
            let cum = 0;
            const topIndex = d.values.reduce((last, v, j) => (v > 0 ? j : last), -1);
            return (
              <g key={d.key}>
                {d.values.map((v, j) => {
                  if (v <= 0) return null;
                  const yTop = y(cum + v);
                  const yBottom = y(cum) - (cum > 0 ? GAP : 0);
                  cum += v;
                  const h = yBottom - yTop;
                  if (h < 1) return null;
                  const fill = series[j].color;
                  return j === topIndex ? (
                    <path key={j} d={topRounded(x, yTop, barW, h, R)} fill={fill} />
                  ) : (
                    <rect key={j} x={x} y={yTop} width={barW} height={h} fill={fill} />
                  );
                })}
              </g>
            );
          })}

          {/* selective direct label: the peak day's total on its cap */}
          {totals[peak] > 0 ? (
            <text x={cx(peak)} y={y(totals[peak]) - 6} textAnchor="middle" className="fill-ink-2 text-[11px] font-medium tabular-nums">
              {totals[peak]}
            </text>
          ) : null}

          {/* x labels, anchored on the latest day */}
          {data.map((d, i) =>
            (data.length - 1 - i) % labelEvery === 0 ? (
              <text key={d.key} x={cx(i)} y={height - 6} textAnchor="middle" className="fill-faint text-[11px]">
                {d.axisLabel}
              </text>
            ) : null,
          )}

          {/* hit targets: the whole day band, bigger than the mark */}
          {data.map((d, i) => (
            <rect
              key={d.key}
              x={M.left + band * i}
              y={M.top}
              width={band}
              height={plotH + M.bottom}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {active !== null ? `${data[active].title}: ${series.map((s, j) => `${data[active].values[j]} ${s.label.toLowerCase()}`).join(", ")}` : ""}
      </p>
      {active !== null && width > 0 ? (
        <Tooltip
          x={cx(active)}
          y={y(totals[active])}
          width={width}
          title={data[active].title}
          rows={series.map((s, j) => ({ color: s.color, value: String(data[active].values[j]), label: s.label }))}
          footer={`${totals[active]} in total`}
        />
      ) : null}
    </div>
  );
}
