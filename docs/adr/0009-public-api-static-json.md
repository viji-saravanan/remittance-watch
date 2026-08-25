# ADR-0009 · Public API v1: path-mapped static JSON under `/v1/`

- Status: accepted · Date: 2026-08-25 · Deciders: viji-saravanan · Implements: issue #5 (M3)

## Context

Issue #5 sketches `GET /v1/corridors/{from}/{to}` and `GET /v1/quote?from=&to=&amount=` — a
query-string endpoint among them. ADR-0005 already fixed the serving model before this
milestone existed: zero servers, everything rendered at ingest time, static artifacts on the
GitHub Pages CDN. A static CDN cannot route on query strings, and standing up a runtime
(Worker, Function) to translate `?from=USA&to=IND` into a file lookup would reintroduce the
exact cost ADR-0005 removed — for an audience (researchers, journalists) that values *stable,
citable URLs* over request-time flexibility.

The explorer bundle (ADR-0008) proved the payload design: precomputed, deterministic, ranked
verbatim. ADR-0008's own consequence — "M3's public API becomes an act of publishing, not
building" — is what this ADR executes.

## Options

| Option | For | Against |
|---|---|---|
| **Path-mapped static files** (`/v1/quote/USA/IND/200.json`) | Zero runtime; every URL is citable and git-diffable; CDN-cached; 404 is honest (corridor not surveyed) | Path params instead of query strings (documented in OpenAPI, so equivalent for machines) |
| Cloudflare Worker translating queries to static fetches | Issue's literal query-string shape | New account + deploy surface for URL cosmetics; ADR-0005 explicitly deferred this until request-time compute is *needed* |
| Keep the single explorer bundle as "the API" | Already shipped | One ~1.5 MB download to read one corridor; compressed keys (`tc`, `m`) violate rule 1; no per-corridor citation; not an API in any audience's vocabulary |

## Decision

**Emit static JSON at ingest time** (`rw-ingest export-api` → `public/v1/…`, committed like
every artifact). Endpoints, all `GET`, all under the site's base path:

| URL | Payload |
|---|---|
| `/v1/corridors.json` | Index: every corridor with names, ranked-quote count, $200 average, quarter |
| `/v1/corridors/{from}/{to}.json` | One corridor: meta, trend (≤4 quarters), ALL quotes both tiers, ranked cheapest-first (ADR-0007) |
| `/v1/quote/{from}/{to}/{amount}.json` | The issue's `/v1/quote?from=&to=&amount=`, path-mapped: ranked + not-ranked quotes for one corridor at one published tier (`200`/`500`) |
| `/v1/openapi.json` | The spec describing all of the above |

Rules:

1. **Readable, stable field names.** The explorer bundle compresses keys for wire size
   (`p`, `i`, `tc`); the API does not — its audience pipes these into notebooks and articles.
   `provider`, `instrument`, `access_point`, `amount_usd`, `fee_pct`, `fx_margin_pct`,
   `total_cost_pct`, `transparent`. Renames are breaking (see policy).
2. **Self-describing payloads.** Every file carries `meta` (quarter, `generated_utc`,
   source workbook, license, link) so a single saved file stays citable without the site.
3. **Version policy.** Path version (`/v1/`) is the contract. Additive changes (new optional
   fields, new corridors) ship in place. Breaking changes (field renames/removals, semantic
   changes) ship as `/v2/` with `/v1/` dual-running for at least one full quarter (~3 months)
   and a README deprecation banner from the day `/v2/` lands.
4. **Caching & rate limits.** Pages serves `cache-control: max-age=600`; payloads carry
   `generated_utc` so stale reads are detectable. No rate limiting exists or is needed
   (static CDN); fair use is the repo's 100 GB/month soft bandwidth cap — at ~5 KB/file that
   is on the order of a million corridor fetches/day before it matters. Bulk exports remain
   out of scope (issue #5); researchers needing bulk should clone the repo — the artifacts
   ARE the dataset.
5. **404 semantics.** A missing file means the World Bank did not publish that corridor/tier
   this quarter. The index (`/v1/corridors.json`) is the discovery surface; nothing pretends.
6. **One serializer.** `export-api` shares the corridor-index query, rounding (`_r`,
   half-away-from-zero), and ranking ORDER BY (including the `qu.id` tiebreak) with
   ADR-0008's exporter — the API and the explorer can never disagree about a number.

## Consequences

- Every README example is a `curl` against a file that exists in the repo at merge time.
  CI enforces what it can mechanically: payload shapes via the shared exporter's fixture
  e2e, plus the committed `/v1/` tree's internal consistency (index ↔ corridor records ↔
  tier slices ↔ OpenAPI spec) with no Postgres needed. Artifact freshness after a quarterly
  re-ingest stays a release step — ingest-check opens exactly that issue — since CI carries
  no workbook to re-derive the artifacts from.
- p95 latency is a CDN property, not our code: measured, recorded in the PR, and re-measurable
  with the same one-liner.
- ~1,050 small committed files per quarter. The quarterly diff is large but purely additive
  per file; review focuses on `corridors.json` + a spot-check, as with the explorer bundle.
- What we deliberately did NOT build: query-string routing, authentication, rate-limit
  middleware, bulk-download endpoints, a docs site (the OpenAPI file + README suffice).
