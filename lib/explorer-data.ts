/* Types + fetcher for the corridor-explorer bundle (ADR-0008). The bundle is
   the committed artifact `public/data/rpw-explorer-v1.json`, emitted by
   `rw-ingest export-explorer` — the client invents nothing: ranking order,
   corridor averages, and trends all arrive precomputed. */

export interface ExplorerQuote {
  /** corridor index into `corridors` */
  c: number;
  /** published tier — the only amounts that exist: 200 | 500 */
  t: number;
  /** provider */
  p: string;
  /** payment instrument */
  i: string;
  /** access point (may be absent upstream) */
  a: string | null;
  /** fee % of the transfer (fee ÷ LCU amount) */
  f: number | null;
  /** FX margin % — null when not disclosed */
  m: number | null;
  /** published total cost % — may legitimately be negative (ADR-0007) */
  tc: number | null;
  /** transparent (margin disclosed)? Non-transparent rows are never ranked. */
  x: boolean;
}

export interface TrendPoint {
  q: string;
  avg: number | null;
  cheapest: number | null;
}

export interface ExplorerCorridor {
  from: string;
  to: string;
  from_name: string;
  to_name: string;
  /** transparent $200 quotes ranked this quarter (0 → nothing-disclosed view) */
  quotes: number;
  avg_cost_pct: number | null;
  trend: TrendPoint[];
}

export interface ExplorerData {
  meta: {
    version: number;
    quarter: string;
    generated_utc: string;
    generator: string;
    source: { workbook: string; license: string; url: string };
    amounts: number[];
    policy: { ranking: string; negative_margin: string; non_transparent: string };
  };
  countries: { iso3: string; name: string }[];
  corridors: ExplorerCorridor[];
  quotes: ExplorerQuote[];
}

/* Relative to the page URL: trailingSlash export puts every page in a
   directory, so "../data/…" resolves inside the app root at ANY base path —
   /remittance-watch/ today, a domain root if basePath is ever retired —
   with zero build-time configuration. */
export const BUNDLE_URL = "../data/rpw-explorer-v1.json";

export async function fetchExplorerData(signal?: AbortSignal): Promise<ExplorerData> {
  const res = await fetch(BUNDLE_URL, { signal, cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`explorer bundle unavailable (HTTP ${res.status})`);
  }
  return (await res.json()) as ExplorerData;
}

/** A quote that can rank: transparent AND with a published total cost. The
    narrowing is what keeps every rendered number traceable — ranked rows can
    never fall back to a computed or zero total downstream. */
export type RankedQuote = ExplorerQuote & { tc: number };

/** Ranked and flagged quotes for one corridor and tier. The exporter pre-sorts
    cheapest-first within corridor×tier, so filtering preserves the ADR-0007
    ranking — the client never re-sorts. Ranking needs BOTH disclosures: a row
    that hides the margin, or publishes no total, is flagged instead — shown,
    never ranked (no quote silently vanishes). */
export function splitQuotes(
  data: ExplorerData,
  corridorIndex: number,
  tier: number,
): { ranked: RankedQuote[]; flagged: ExplorerQuote[] } {
  const rows = data.quotes.filter((q) => q.c === corridorIndex && q.t === tier);
  const rankable = (q: ExplorerQuote): q is RankedQuote => q.x && q.tc !== null;
  return {
    ranked: rows.filter(rankable),
    flagged: rows.filter((q) => !rankable(q)),
  };
}

export const fmtPct = (v: number): string => `${v.toFixed(2)}%`;

export const fmtUsd = (pct: number, amount: number): string =>
  `${((pct / 100) * amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })}`;
