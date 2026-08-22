# ADR-0003 · FX rate source: exchange-api chain, snapshot-first, never republish restricted rates

- Status: accepted · Date: 2026-08-22 · Deciders: viji-saravanan, callmearya

## Context

We need daily mid-market reference rates for every corridor currency (INR, PHP, NGN, PKR, BDT,
ETB…) to compute "FX margin vs today's market" overlays on RPW's applied rates. Requirements:
no paid tier (charter), license permitting storage/serving of derived values, global coverage.
Research (docs/research/02, all candidates tested live): exchangerate.host is now keyed/paid;
ECB direct lacks corridor currencies; open.er-api.com forbids redistribution; fawazahmed0/
exchange-api is CC0, keyless, 341 currencies, daily.

## Decision

**Primary:** `fawazahmed0/exchange-api` static JSON via jsDelivr with the README-mandated
pages.dev fallback. **Runtime-only fallback:** `open.er-api.com` (cache permitted; **never
persisted or served** — its terms forbid redistribution). **Cross-check:** Frankfurter v2
(`providers=ECB`) for drift detection in the daily job's logs.

Rules:
1. Daily GitHub Actions job stores the raw USD/EUR snapshots **with their embedded `date`
   field** (jsDelivr `@latest` can lag a day — never assume freshness).
2. Cross rates computed locally from stored snapshots; no per-request third-party calls.
3. These are **mid-market reference rates**, not consumer remittance rates — methodology page
   states this explicitly; we compare RPW's applied rate against the same-day reference.

## Consequences

- FX overlay degrades gracefully: if all sources fail, UI shows RPW quarter data without the
  overlay and a visible staleness note (honesty surfaces rule).
- What breaks first at 10×: nothing — one CDN fetch/day. If jsDelivr + pages.dev both vanish
  upstream (project archived), fallback order re-evaluated; Frankfurter promoted.
