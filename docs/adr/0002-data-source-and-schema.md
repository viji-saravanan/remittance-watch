# ADR-0002 · Data source & schema: parse the Data Catalog workbook, flag non-transparency

- Status: accepted · Date: 2026-08-22 · Deciders: viji-saravanan, callmearya

## Context

Research (docs/research/01) established: official RPW site is Cloudflare-walled; the World Bank
API is stale-since-2020 with **no corridor-level data**; the only viable programmatic source is
the Data Catalog dataset [0037898] xlsx (CC BY 4.0). Workbook semantics verified by inspection:
one row = provider × corridor × quarter × instrument; amounts as cc1/cc2 column blocks ($200/$500);
`total% = fee/amount×100 + fx_margin`; non-transparent providers store fx margin as literal 0.

## Options considered

1. Scrape comparators / reverse-engineer provider quote APIs — rejected: ToS-hostile, brittle,
   and destroys our positioning (research §03).
2. Wait for World Bank to fix their API — rejected: stale six years already.
3. **Parse the catalog workbook** — accepted.

## Decision

Schema v1 (drizzle migrations, snake_case per Postgres conventions):

```
quarters(code PK '2025_3Q')                      -- note: 2025_2Q does not exist upstream
countries(iso3 PK, name, region, income_group)
providers(id IDENTITY PK, name UNIQUE)
corridors(source_iso3 FK→countries, dest_iso3 FK→countries, PK(source,dest))
quotes(
  id BIGINT GENERATED ALWAYS AS IDENTITY PK,
  quarter_code FK→quarters NOT NULL,
  source_iso3, dest_iso3   FK→corridors composite,
  provider_id FK→providers NOT NULL,
  amount_usd NUMERIC NOT NULL CHECK (amount_usd IN (200, 500)),
  instrument_norm TEXT NOT NULL,      -- normalized via maintained map ('cash','bank_account','mobile_money',…)
  instrument_raw TEXT NOT NULL,       -- verbatim upstream string, provenance
  lcu_code TEXT NOT NULL, fee_lcu NUMERIC, lcu_amount NUMERIC,
  fx_rate_applied NUMERIC, interbank_fx_rate NUMERIC,
  fx_margin_pct NUMERIC,              -- NULL when transparent = false (never trust the stored 0)
  total_cost_pct NUMERIC,
  transparent BOOLEAN NOT NULL,
  collected_on DATE, raw_row_hash TEXT UNIQUE NULLS NOT DISTINCT  -- idempotent re-runs
)
CREATE INDEX ON quotes (quarter_code, source_iso3, dest_iso3);
CREATE INDEX ON quotes (provider_id);
```

Rules encoded:
- Money/rates are **NUMERIC**, never float. Timestamps TIMESTAMPTZ. Text not VARCHAR.
- `fx_margin_pct` set to **NULL** for non-transparent rows (upstream's 0 is a lie of absence).
  Default rankings exclude them behind an explicit "show non-transparent providers" toggle.
- Legacy pre-2016 sheet out of scope (different schema); recorded here so nobody "discovers" it later.
- Raw xlsx snapshots committed under `tests/fixtures/` (truncated sample) for contract tests;
  full snapshots live outside git.

## Consequences

- Quarterly ingest resolves the current resource URL from the catalog (IDs change per release),
  streams rows, normalizes instruments via versioned map, hashes rows for idempotent upserts.
- Unlabeled trailing columns (43–47 in Q3-2025) are ignored by header-name mapping only —
  positional parsing forbidden.
- At 10× scale (decades × more corridors): quotes table grows ~10k rows/quarter — trivial for
  plain Postgres; no partitioning until >100M rows (we'd be dead before that matters).
