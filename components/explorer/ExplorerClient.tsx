"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  Clock,
  EyeOff,
  RotateCw,
  SearchX,
  Sparkles,
} from "lucide-react";

import {
  fetchExplorerData,
  splitQuotes,
  fmtPct,
  fmtUsd,
  type ExplorerData,
  type ExplorerQuote,
} from "../../lib/explorer-data";
import { Loading } from "./Loading";
import { TrendChart } from "./TrendChart";

/* The corridor explorer (M2): pick a corridor → every provider ranked by true
   total cost, exactly as published (ADR-0007). All data arrives precomputed in
   the versioned bundle; this component adds only selection, projection, and
   the designed states the milestone requires (loading, error, empty,
   nothing-disclosed, stale-data). Selection lives in the URL so any ranking
   is shareable. */

const DEFAULT_FROM = "USA";
const DEFAULT_TO = "IND";
/** India ↔ Gulf — the world's largest corridor family, featured per the M2 issue. */
const GCC = new Set(["ARE", "BHR", "KWT", "OMN", "QAT", "SAU"]);

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; data: ExplorerData };

export function ExplorerClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [tick, setTick] = useState(0); // bumped by Retry

  const from = params.get("from") ?? DEFAULT_FROM;
  const to = params.get("to") ?? DEFAULT_TO;
  const tier = Number(params.get("amt")) === 500 ? 500 : 200;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ status: "loading" });
    fetchExplorerData(ctrl.signal)
      .then((data) => setLoad({ status: "ready", data }))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setLoad({ status: "error" });
      });
    return () => ctrl.abort();
  }, [tick]);

  const navigate = useCallback(
    (next: { from?: string; to?: string; amt?: number }) => {
      const q = new URLSearchParams({
        from: next.from ?? from,
        to: next.to ?? to,
        amt: String(next.amt ?? tier),
      });
      router.replace(`?${q}`, { scroll: false });
    },
    [router, from, to, tier],
  );

  if (load.status === "loading") return <Loading label="Loading corridor prices" />;
  if (load.status === "error")
    return (
      <div className="ex-state ex-state--error" role="alert">
        <SearchX size="1.5em" aria-hidden />
        <p>The price bundle didn&rsquo;t load. It&rsquo;s a static file — this is usually transient.</p>
        <button type="button" className="ex-retry" onClick={() => setTick((t) => t + 1)}>
          <RotateCw size="1em" aria-hidden /> Retry
        </button>
      </div>
    );

  return (
    <Explorer ready={load.data} from={from} to={to} tier={tier} onNavigate={navigate} />
  );
}

function Explorer({
  ready,
  from,
  to,
  tier,
  onNavigate,
}: {
  ready: ExplorerData;
  from: string;
  to: string;
  tier: number;
  onNavigate: (next: { from?: string; to?: string; amt?: number }) => void;
}) {
  const { meta, countries, corridors } = ready;

  const byName = useMemo(() => new Map(countries.map((c) => [c.iso3, c.name])), [countries]);
  const corridorIdx = useMemo(
    () => corridors.findIndex((c) => c.from === from && c.to === to),
    [corridors, from, to],
  );
  const corridor = corridorIdx >= 0 ? corridors[corridorIdx] : null;
  const { ranked, flagged } = useMemo(
    () => (corridorIdx >= 0 ? splitQuotes(ready, corridorIdx, tier) : { ranked: [], flagged: [] }),
    [ready, corridorIdx, tier],
  );

  const featured = useMemo(
    () =>
      corridors
        .filter(
          (c) =>
            (c.from === "IND" && GCC.has(c.to)) || (c.to === "IND" && GCC.has(c.from)),
        )
        .sort((a, b) => b.quotes - a.quotes)
        .slice(0, 6),
    [corridors],
  );

  const suggestions = useMemo(() => {
    if (corridor) return [];
    return corridors
      .filter((c) => c.from === from || c.to === to)
      .sort((a, b) => b.quotes - a.quotes)
      .slice(0, 5);
  }, [corridors, corridor, from, to]);

  return (
    <div className="ex">
      {/* ── search ─────────────────────────────────────────────────────── */}
      <section className="ex-search" aria-label="Choose a corridor">
        <div className="ex-pickers">
          <label className="ex-field">
            <span>From</span>
            <select value={from} onChange={(e) => onNavigate({ from: e.target.value })}>
              {countries.map((c) => (
                <option key={c.iso3} value={c.iso3}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ex-swap"
            title="Swap direction"
            onClick={() => onNavigate({ from: to, to: from })}
          >
            <ArrowLeftRight size="1em" aria-hidden />
            <span className="sr-only">Swap origin and destination</span>
          </button>
          <label className="ex-field">
            <span>To</span>
            <select value={to} onChange={(e) => onNavigate({ to: e.target.value })}>
              {countries.map((c) => (
                <option key={c.iso3} value={c.iso3}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="ex-tier">
            <legend className="sr-only">Transfer amount</legend>
            {meta.amounts.map((amt) => (
              <label key={amt} className={amt === tier ? "is-on" : ""}>
                <input
                  type="radio"
                  name="amt"
                  value={amt}
                  checked={amt === tier}
                  onChange={() => onNavigate({ amt })}
                />
                ${amt}
              </label>
            ))}
          </fieldset>
        </div>

        {featured.length > 0 && (
          <div className="ex-featured">
            <span className="ex-featured-label">India ↔ Gulf — the world&rsquo;s biggest corridor family</span>
            <div className="ex-featured-chips">
              {featured.map((c) => {
                const on = c.from === from && c.to === to;
                return (
                  <button
                    key={`${c.from}-${c.to}`}
                    type="button"
                    className={`ex-chip tnum${on ? " is-on" : ""}`}
                    onClick={() => onNavigate({ from: c.from, to: c.to })}
                  >
                    {c.from}
                    {"→"}
                    {c.to} <b>{c.avg_cost_pct === null ? "—" : fmtPct(c.avg_cost_pct)}</b>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── result ─────────────────────────────────────────────────────── */}
      {corridor ? (
        <section aria-label={`Providers on ${corridor.from_name} to ${corridor.to_name}`}>
          <header className="ex-head">
            <h2 className="ex-route">
              {corridor.from_name} <span aria-hidden="true">→</span> {corridor.to_name}
            </h2>
            <p className="ex-vintage" title={`Bundle generated ${meta.generated_utc}`}>
              <Clock size="1em" aria-hidden /> {meta.quarter.replace("_", " ")} prices
              <span className="ex-vintage-note"> · World Bank surveys quarterly, ~2 quarters behind</span>
            </p>
          </header>

          {ranked.length > 0 ? (
            <>
              <p className="ex-summary tnum">
                {ranked.length} providers ranked by total cost · cheapest{" "}
                <b>{fmtPct(ranked[0]!.tc ?? 0)}</b> ({fmtUsd(ranked[0]!.tc ?? 0, tier)}) · average{" "}
                <b>{corridor.avg_cost_pct === null ? "—" : fmtPct(corridor.avg_cost_pct)}</b>
              </p>
              <ol className="ex-rows">
                {ranked.map((q, i) => (
                  <Row key={`${q.p}-${q.i}-${q.a ?? ""}`} quote={q} rank={i + 1} tier={tier} />
                ))}
              </ol>
            </>
          ) : (
            <div className="ex-state">
              <EyeOff size="1.5em" aria-hidden />
              <p>
                No provider on this corridor disclosed its exchange-rate margin in {meta.quarter}.
                Nothing is ranked — a fee without the margin isn&rsquo;t the true cost.
              </p>
            </div>
          )}

          {flagged.length > 0 && (
            <details className="ex-flagged">
              <summary>
                <EyeOff size="1em" aria-hidden /> {flagged.length} quote{flagged.length > 1 ? "s" : ""}{" "}
                don&rsquo;t disclose the margin — shown, never ranked
              </summary>
              <ul className="ex-flagged-list">
                {flagged.map((q, i) => (
                  <li key={`${q.p}-${q.i}-${i}`}>
                    <b>{q.p}</b>
                    <span className="ex-quiet">
                      {q.i}
                      {q.a ? ` · ${q.a}` : ""} · ${q.t}
                    </span>
                    <span className="tnum">
                      total <b>{q.tc === null ? "—" : fmtPct(q.tc)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {corridor.trend.length >= 2 && <TrendChart trend={corridor.trend} />}
        </section>
      ) : (
        <div className="ex-state" role="status">
          <SearchX size="1.5em" aria-hidden />
          <p>
            No {byName.get(from) ?? from} → {byName.get(to) ?? to} prices in {meta.quarter}. The
            World Bank doesn&rsquo;t survey every corridor every quarter.
          </p>
          {suggestions.length > 0 && (
            <div className="ex-suggest">
              <span>Closest with data:</span>
              {suggestions.map((c) => (
                <button
                  key={`${c.from}-${c.to}`}
                  type="button"
                  className="ex-chip"
                  onClick={() => onNavigate({ from: c.from, to: c.to })}
                >
                  {c.from}→{c.to} <b>{c.avg_cost_pct === null ? "—" : fmtPct(c.avg_cost_pct)}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── methodology (the policy text ships IN the bundle — ADR-0007/0008) ── */}
      <details className="ex-method">
        <summary>How these rankings work</summary>
        <p>{meta.policy.ranking}</p>
        <p>{meta.policy.negative_margin}</p>
        <p>{meta.policy.non_transparent}</p>
        <p className="ex-quiet">
          {meta.source.workbook} · {meta.source.license} ·{" "}
          <a href={meta.source.url} target="_blank" rel="noopener noreferrer">
            source data
          </a>
        </p>
      </details>
    </div>
  );
}

/* One ranked row: rank · provider · diverging cost bar · total. The bar is a
   composition on a shared zero axis — fee (green) extends right from zero,
   the margin (orange) continues right or extends back LEFT when negative —
   so a negative total genuinely reads as ending behind zero. Rows with no
   negatives render as a plain stacked bar (zero axis sits at the left edge). */
function Row({ quote, rank, tier }: { quote: ExplorerQuote; rank: number; tier: number }) {
  const fee = quote.f ?? 0;
  const margin = quote.m ?? 0;
  const total = quote.tc ?? fee + margin;
  const negativeMargin = margin < 0;
  const negativeTotal = total < 0;

  return (
    <li className={`ex-row${negativeTotal ? " is-negative" : ""}`}>
      <span className="ex-rank tnum" aria-hidden="true">
        {rank}
      </span>
      <div className="ex-who">
        <b>{quote.p}</b>
        <span className="ex-quiet">
          {quote.i}
          {quote.a ? ` · ${quote.a}` : ""}
        </span>
        {negativeMargin && (
          <span className="ex-badge" title="The provider's exchange rate beats the World Bank reference rate">
            <Sparkles size="0.9em" aria-hidden /> rate advantage
          </span>
        )}
      </div>
      <CostBar fee={fee} margin={margin} />
      <div className="ex-total tnum">
        <b>{fmtPct(total)}</b>
        <span className="ex-quiet">{fmtUsd(total, tier)} per ${tier}</span>
      </div>
      {negativeTotal && <p className="ex-negnote">{NEGATIVE_NOTE}</p>}
    </li>
  );
}

function CostBar({ fee, margin }: { fee: number; margin: number }) {
  /* scale is per-row (each bar fills its track) but the ZERO AXIS is what
     carries meaning for negatives: the track spans [−|margin| … +fee], so the
     marker sits where the negative side ends — a published fee of 0 puts zero
     at the right edge with the whole track behind it. The signed numbers
     beside every bar keep the cross-row comparison honest. */
  const magnitude = Math.max(fee + Math.abs(margin), 0.01);
  const zeroX = margin < 0 ? (Math.abs(margin) / magnitude) * 100 : 0;
  const feeW = (fee / magnitude) * 100;
  const marginW = (Math.abs(margin) / magnitude) * 100;
  return (
    <div
      className="ex-bar"
      role="img"
      aria-label={`Fee ${fee.toFixed(2)} percent, exchange-rate margin ${margin.toFixed(2)} percent`}
    >
      {margin < 0 && (
        <i
          className="ex-bar-zero"
          style={{ left: `clamp(0px, calc(${zeroX}% - 1px), calc(100% - 2px))` }}
          aria-hidden="true"
        />
      )}
      {fee > 0 && (
        <i
          className="ex-seg ex-seg--fee"
          style={margin < 0 ? { left: `${zeroX}%`, width: `${feeW}%` } : { left: 0, width: `${feeW}%` }}
          aria-hidden="true"
        />
      )}
      {margin !== 0 && (
        <i
          className="ex-seg ex-seg--margin"
          style={margin < 0 ? { left: 0, width: `${marginW}%` } : { left: `${feeW}%`, width: `${marginW}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

const NEGATIVE_NOTE =
  "Total cost is below zero: this provider's exchange rate beats the World Bank's reference rate, so cost measured against the official rate is negative. The printed fee is still positive.";
