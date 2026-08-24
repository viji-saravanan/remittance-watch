# ADR-0008 · Explorer data: one versioned JSON bundle, fetched lazily

- Status: accepted · Date: 2026-08-24 · Deciders: viji-saravanan

## Context

M2 turns the landing into a product: pick a corridor → see every provider ranked by true
total cost, with a per-corridor trend. ADR-0005 fixed the serving model — GitHub Pages
static export, Postgres demoted to a transform workspace, "the serving source of truth is
versioned artifacts committed to the repo." What it left open is the *shape* of the M2
artifact and how the explorer consumes it.

The dataset involved: ~368 corridors with latest-quarter coverage, ~6,470 transparent $200
quotes (~12,900 with the $500 tier), 37 quarters of history for trends.

## Options

| Option | For | Against |
|---|---|---|
| **One committed bundle, client-fetched** (`public/data/rpw-explorer-v1.json`) | Genuine loading/error/empty states (M2 issue requires them); route JS stays tiny (lazy `ssr:false` client component); the exact JSON M3's API will serve — build the API by publishing what we already fetch; one artifact = one reviewable diff per quarter | ~1–2 MB raw (~300 KB gzipped) fetched on first explorer visit |
| Build-time import into the page bundle | No fetch, no loading state | Data ships in First Load JS even for visitors who never open the explorer; loading/error states become fake; M3 would need a second artifact shape |
| Per-corridor static files (368 × quarterly) | Smallest per-visit payload | 368-file diffs are unreviewable in PRs; pickers need a corridor index anyway (a 369th file); request waterfall on search |
| Pre-rendered corridor pages at build (`generateStaticParams`) | Fastest corridor loads | Loading/error/empty states impossible by construction; search still needs client data; 368 pages to hydrate |

## Decision

- **`rw-ingest export-explorer`** emits **`public/data/rpw-explorer-v1.json`** — committed,
  deterministic, regenerated at each ingest. Version lives in the path (`v1`); breaking
  schema changes create `v2` alongside, never in place.
- **Bundle contents** (and nothing more): meta (quarter, generated_utc, source, policy
  note), countries present in latest-quarter corridors, the corridor index (names, quote
  counts, average cost), every latest-quarter quote for **both published tiers** ($200,
  $500 — provider, instrument, access point, fee%, margin%, total%, transparency), and a
  per-corridor 4-quarter trend ($200 tier: average and cheapest).
- **Consumption:** `/explorer` renders a static shell, then a lazy `ssr:false` client
  component fetches the bundle (browser-cached). Corridor detail is client state mirrored
  to the URL (`?from=USA&to=IND`) — shareable, keyboard-navigable, no per-corridor pages.
- **The landing stays build-time.** `site-data.json` gains `featured_corridors` (the
  India↔GCC family, computed) so the teaser strip needs no fetch.

## Consequences

- The explorer's loading skeleton, error state, and stale-data badge are *real* — they
  describe the actual fetch of an actual artifact.
- M3's public API becomes an act of publishing, not building: `/v1/` endpoints serve this
  same JSON (split per ADR-0005's sketch when the time comes).
- First explorer visit pays ~300 KB gzipped once; GitHub Pages serves it gzip-compressed
  and CDN-cached. Accepted — it is the product's core page, and quarterly data cannot
  benefit from finer partitioning at this scale.
- The bundle must stay deterministic (stable ordering, rounded values) so quarterly
  regeneration produces reviewable diffs — same rule as `site-data.json`.
