"use client";

import { useState } from "react";

import type { TrendPoint } from "../../lib/explorer-data";
import { fmtPct } from "../../lib/explorer-data";

/* Two series, ≤4 points: cheapest (green --chart-1) under corridor average
   (steel blue --chart-2). Marks are HTML-positioned so text stays rem-true at
   every viewport; only the connecting segments are SVG (preserveAspectRatio
   "none" + vector-effect keeps strokes 2px under non-uniform scale). Series
   colors are the validated token pair (dataviz six-checks, light + dark). */

const PAD_X = 7; // % kept clear at each end so dots/labels never clip
const PAD_Y = 0.08; // fraction of domain kept clear top and bottom

/** Clean tick steps: 1/2/5 × 10^k covering the domain in ~3 lines. */
function ticks(min: number, max: number): number[] {
  const span = max - min || 1;
  const raw = span / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => span / s <= 4) ?? pow * 10;
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const values = trend.flatMap((p) => [p.avg, p.cheapest].filter((v): v is number => v !== null));
  if (trend.length < 2 || values.length < 2) return null;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const min = lo - (hi - lo) * PAD_Y;
  const max = hi + (hi - lo) * PAD_Y;
  const n = trend.length;
  const x = (i: number) => PAD_X + (i * (100 - 2 * PAD_X)) / (n - 1);
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;

  const series = [
    { key: "avg", label: "Corridor average", color: "var(--chart-2)", below: false },
    { key: "cheapest", label: "Cheapest quote", color: "var(--chart-1)", below: true },
  ] as const;

  const last = trend[n - 1]!;
  const first = trend[0]!;
  const delta = last.avg !== null && first.avg !== null ? last.avg - first.avg : null;

  return (
    <figure className="trend">
      <figcaption className="trend-caption">
        <span>
          Average cost of sending $200, last {n} quarters
          {delta !== null && (
            <b className="tnum">
              {" "}
              ({delta >= 0 ? "+" : "−"}
              {Math.abs(delta).toFixed(2)} pts)
            </b>
          )}
        </span>
        <span className="trend-legend" aria-hidden="true">
          {series.map((s) => (
            <span key={s.key} className="trend-key">
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>

      <div className="trend-plot">
        {ticks(min, max).map((t) => (
          <div key={t} className="trend-grid" style={{ top: `${y(t)}%` }} aria-hidden="true">
            <span className="trend-tick tnum">{t}%</span>
          </div>
        ))}

        {/* segments: one non-scaling SVG line per pair of points */}
        <svg className="trend-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {series.map((s) => (
            <polyline
              key={s.key}
              points={trend
                .map((p, i) => (p[s.key] === null ? null : `${x(i)},${y(p[s.key] as number)}`))
                .filter((pt): pt is string => pt !== null)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {series.map((s) =>
          trend.map((p, i) =>
            p[s.key] === null ? null : (
              <i
                key={`${s.key}-${i}`}
                className="trend-dot"
                style={{
                  left: `${x(i)}%`,
                  top: `${y(p[s.key] as number)}%`,
                  background: s.color,
                }}
                aria-hidden="true"
              />
            ),
          ),
        )}

        {/* direct end labels: average above its end, cheapest below — the
           series never cross (cheapest ≤ average), so these never collide */}
        {last.avg !== null && (
          <span className="trend-end tnum" style={{ left: `${x(n - 1)}%`, top: `${y(last.avg)}%` }}>
            <i style={{ background: "var(--chart-2)" }} />
            {fmtPct(last.avg)}
          </span>
        )}
        {last.cheapest !== null && (
          <span
            className="trend-end trend-end--low tnum"
            style={{ left: `${x(n - 1)}%`, top: `${y(last.cheapest)}%` }}
          >
            <i style={{ background: "var(--chart-1)" }} />
            {fmtPct(last.cheapest)}
          </span>
        )}

        {/* keyboard-focusable quarter columns: the hover/focus + tooltip layer.
            Columns overlap the plot edges by design, so the edge tooltips are
            pulled back by each column's own overhang — flush with the plot,
            never overflowing it (WCAG 1.4.10 reflow at phone widths). */}
        {trend.map((p, i) => {
          const colLeft = (x(i - 1) + x(i)) / 2 || 0;
          const colW = 100 / n;
          return (
            <button
              key={p.q}
              type="button"
              className={`trend-col${active === i ? " is-active" : ""}`}
              style={{ left: `${colLeft}%`, width: `${colW}%` }}
              aria-label={`${p.q}: average ${p.avg === null ? "no data" : fmtPct(p.avg)}, cheapest ${
                p.cheapest === null ? "no data" : fmtPct(p.cheapest)
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {active === i && (
                <span
                  className={`trend-tip tnum${i === 0 ? " trend-tip--start" : i === n - 1 ? " trend-tip--end" : ""}`}
                  role="presentation"
                  style={
                    i === 0
                      ? { left: `${(-colLeft / colW) * 100}%` } // cancel the column's left overhang
                      : i === n - 1
                        ? { right: `${((colLeft + colW - 100) / colW) * 100}%` }
                        : undefined
                  }
                >
                  <b>{p.q.replace("_", " ")}</b>
                  {series.map((s) => (
                    <span key={s.key}>
                      <i style={{ background: s.color }} />
                      {s.label}: {p[s.key] === null ? "—" : fmtPct(p[s.key] as number)}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="trend-xlabels" aria-hidden="true">
        {trend.map((p) => (
          <span key={p.q}>{p.q.replace("_", " ")}</span>
        ))}
      </div>

      {/* the table view: same numbers, no color or hover required */}
      <table className="trend-table tnum">
        <caption className="sr-only">Quarterly average and cheapest total cost</caption>
        <thead>
          <tr>
            <th scope="col">Quarter</th>
            <th scope="col">Corridor average</th>
            <th scope="col">Cheapest quote</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((p) => (
            <tr key={p.q}>
              <th scope="row">{p.q.replace("_", " ")}</th>
              <td>{p.avg === null ? "—" : fmtPct(p.avg)}</td>
              <td>{p.cheapest === null ? "—" : fmtPct(p.cheapest)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
