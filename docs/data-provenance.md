# Data provenance — Remittance Prices Worldwide (RPW)

Where the data comes from, how we get it, what its quirks are, and how it
refreshes. The pipeline that implements this lives in [`pipeline/`](../pipeline/);
ground-truth research in [`docs/research/01-rpw-dataset.md`](research/01-rpw-dataset.md).

## Source

| | |
|---|---|
| Dataset | **Remittance Prices Worldwide** (RPW), World Bank |
| Catalog entry | <https://datacatalog.worldbank.org/search/dataset/0037898> |
| API | DDH OpenAPI `https://ddh-openapi.worldbank.org/datasets/0037898` — no key, no auth, no UA requirements |
| License | **CC BY 4.0** per catalog metadata (see [caveat](#license-caveat)) |
| Cadence | Quarterly, lagging the survey quarter by ~2 quarters (Q3 2025 is the newest release as of August 2026, published May 2026) |
| First accessed | 2026-08-22 |
| File | `rpw_dataset_2011_2025_q3.xlsx` — 50,762,620 bytes |
| sha256 | `02e7ec01e461d027e4c805413839e3378f58366d2660cfeadfff140db288cf82` |

One row = **provider × corridor × quarter × instrument combination**, carrying two
parallel cost tiers: `$200` (`cc1` columns) and `$500` (`cc2` columns). The main
sheet is `Dataset (from Q2 2016)` — 42 named columns plus junk cells beyond
column 42 that the pipeline ignores.

## How the pipeline fetches it

The catalog entry's internal dataset id **changes between releases**, so nothing
may hard-code a download URL. `rw-ingest fetch` resolves the current release:

1. `GET /datasets/0037898` → JSON with a `resources[]` array;
2. filter resources whose `url` matches `^rpw_dataset_.+\.xlsx$` and take the
   last candidate (the catalog lists newest last);
3. download — direct blob URL first, falling back to the byte-identical proxy
   `/resources/{id}/download`;
4. record `sha256 · resource id · release name · modified date` to
   `var/provenance.log` — the raw material for this document's refresh history.

Re-runs are safe: ingestion is idempotent (quotes are keyed by a hash of the
entire source row plus tier, so re-ingesting the same file changes nothing, and
a corrected file updates rows in place — see ADR-0002).

## Known upstream quirks (and what we do about each)

These are properties of the World Bank data, verified against the full
`2011_2025_q3` release. The pipeline handles them explicitly rather than
silently:

1. **The decomposition identity is ~99.98% true, not 100%.** For transparent
   rows, `total cost % = fee ÷ lcu amount × 100 + fx margin %` holds within
   0.05pp for **401,071 of 401,156** transparent tiers. The 85 violators all sit
   in 2016–2020 survey waves (e.g. row 734, Money Express CMR→NGA 2016_2Q:
   fee computes 5.70% but the published total reads 0.43% — its own note flags
   FX comparability problems). The parser **records** these as `MathViolation`s
   and keeps the WB's published number (it remains the official figure); the
   CLI fails the ingest only if violations exceed 1% of checked tiers — 50× the
   observed baseline — which would signal structural drift, not known quirks.
   `--strict` restores abort-on-first-violation.

2. **Non-transparent rows store FX margin as a literal `0` — a lie.** Their
   notes say so ("0 does not mean no cost"). We store `fx_margin_pct = NULL`
   and `transparent = false` so no ranking ever treats the zero as a real
   margin (ADR-0002). Their published `total cost %` is kept and flagged.

3. **`fx rate = 1` is a sentinel.** When a provider's rate "did not seem
   comparable to the reference rate" (parallel-market currencies), the sheet
   stores `1` for both provider and interbank rates. The number is stored
   verbatim; consumers must treat `fx_rate = 1` in non-USD corridors as "not
   comparable", not as parity.

4. **Junk beyond column 42.** Stray values appear in columns 43–47 of the real
   file. Ignored — and excluded from the row hash, so they cannot manufacture
   phantom diffs on re-ingest.

5. **`transparent = 'no'` exists only in the 2016–2021 waves.** 6,722 of
   408,938 quotes (1.6%) are non-transparent; the newest is 2021_4Q. From 2022
   onward the WB publishes only transparent rows. Consumers must not assume
   the flag is dead — a future wave could reintroduce it.

6. **FX margins go negative in rate-distorted corridors.** 18,298 quotes have
   a negative FX margin (3,282 a negative total cost) — typically corridors
   into officially-overvalued currencies (e.g. Ethiopia) where providers'
   real rates beat the WB's reference rate. Numbers are stored verbatim;
   how rankings treat negative costs is an explicit M2 product decision, not
   silently normalized away here.

## License caveat

The catalog licenses RPW under **CC BY 4.0**. The workbook's own *Terms* tab
carries older, stricter-sounding language about redistribution of the raw file.
Our reading, and our practice: we do **not** redistribute the raw workbook; we
publish **derived aggregates** (per-corridor cheapest-cost tables, M2+) with
attribution to the World Bank's Remittance Prices Worldwide. This is standard
CC BY practice, but the discrepancy is documented here rather than hidden.
Revisit if the WB's terms team ever responds to a licensing query.

## Refresh

- **Manual:** `uv run rw-ingest ingest --download` (resolves latest, downloads,
  migrates, loads, reports).
- **Automated:** a GitHub Actions workflow runs the pipeline in a
  `postgres:16` service container on a quarterly schedule (with manual
  `workflow_dispatch`), then opens an issue when a new release lands. The
  serving site (M2/M3) reads versioned JSON artifacts committed by that
  pipeline — no hosted database anywhere (ADR-0005).

## Provenance log format

Each `fetch` appends one line to `var/provenance.log`:

```
<sha256>  <catalog resource id>  <release name>  <modified date>
```

Example (the current, real line):

```
02e7ec01e461d027e4c805413839e3378f58366d2660cfeadfff140db288cf82  DR0095523  Remittance Prices Worldwide (Complete Dataset)  2026-05-06T14:46:56+00:00
```
