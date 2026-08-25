# RemitWatch

> Send $200 home and know what it *really* costs before you pick a provider.
> Ranks money-transfer services by true total cost — the visible fee **plus** the margin
> hidden inside the exchange rate — using the World Bank's open pricing data.
> No affiliate links. The ranking cannot be bought.

**Status:** M0–M2 shipped — [live on GitHub Pages](https://viji-saravanan.github.io/remittance-watch/).
M1 (ingestion pipeline) merged: 204,469 source rows → 408,938 quotes across 37 quarters,
contract-tested, idempotent, [packaged as a container](https://ghcr.io/viji-saravanan/rw-ingest).
M2 shipped the GSAP scroll-story landing and the corridor explorer — every provider on a
corridor ranked by true total cost, keyboard-navigable, Lighthouse 95/100/100/100 mobile.
M3 ships the public API (below). [Build log →](https://github.com/viji-saravanan/remittance-watch/issues?q=milestone%3A%22M0%22)

## Why this exists

The global average cost of sending $200 is **6.36%** (Q3 2025) against a UN target of 3%
by 2030 ([RPW Issue 54](https://remittanceprices.worldbank.org/sites/default/files/2026-04/RPW_main_report_and_annex_Q325.pdf)).
Existing comparators monetize per sign-up, so their rankings lean toward paying partners —
and none decompose the cost hidden inside exchange rates. RemitWatch does both the opposite way:
open data in, transparent ranking out, zero affiliate revenue possible by charter
([ethics rules](CONTRIBUTING.md#the-ethics-charter-read-this-first)).

## Quickstart

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint    # typecheck + eslint (what CI runs)
npm run build   # static export → out/
```

Node ≥ 20. No API keys and no hosted services — the pipeline's Postgres is a local or CI
container (see [`pipeline/`](pipeline/)).

## Public API v1

Every corridor the World Bank surveys, as static JSON on the Pages CDN — no keys, no rate-limit
signup, [OpenAPI spec](https://viji-saravanan.github.io/remittance-watch/v1/openapi.json)
([source](public/v1/openapi.json)). Regenerated at each quarterly ingest; every published
number is diffable in git ([ADR-0009](docs/adr/0009-public-api-static-json.md)).

```bash
# Every surveyed corridor with its $200 average (348 in 2025_3Q)
curl -s https://viji-saravanan.github.io/remittance-watch/v1/corridors.json | jq '.corridors[0]'

# One corridor: every provider, both tiers, ranked cheapest-first (negative totals included)
curl -s https://viji-saravanan.github.io/remittance-watch/v1/corridors/USA/IND.json \
  | jq '.quotes[0] | {provider, fee_pct, fx_margin_pct, total_cost_pct}'

# One corridor at one published tier: ranked vs not-ranked (margin undisclosed)
curl -s https://viji-saravanan.github.io/remittance-watch/v1/quote/USA/IND/200.json \
  | jq '{ranked: (.ranked | length), not_ranked: (.not_ranked | length)}'
```

Every example above works verbatim against production. CI checks the payload shapes against
the same fixtures the pipeline tests use, plus the committed `/v1/` tree's internal
consistency (index ↔ corridor records ↔ tier slices ↔ OpenAPI spec). Field names are stable
and readable (`fx_margin_pct`, never `m`); **404 means the World Bank did not publish that
corridor or tier this quarter** — check
`/v1/corridors.json` for what exists. Responses are CDN-cached (`max-age=600`) and carry
`meta.generated_utc` so a stale read is detectable; there is no rate limiting — fair use is
the repo's 100 GB/month bandwidth cap, and bulk users should clone the repo (the artifacts
*are* the dataset).

**Version policy** ([ADR-0009](docs/adr/0009-public-api-static-json.md)): additive changes
(new optional fields, new corridors) ship in place; breaking changes (field renames/removals,
semantic changes) ship as `/v2/` with `/v1/` dual-running for at least one full quarter and a
deprecation banner here from day one.

## Architecture (one paragraph)

A Next.js 15 app, statically exported to GitHub Pages — there is no server anywhere. A Python
pipeline (uv + openpyxl) parses the World Bank's quarterly workbook inside a CI job (Postgres
as an ephemeral transform workspace) and emits versioned JSON artifacts that both the site and
the public API serve; daily FX rates come from a CC0 CDN, fetched client-side. Zero accounts
beyond GitHub. Decisions and their evidence live in [`docs/adr/`](docs/adr/) — grounded in
verified research under [`docs/research/`](docs/research/).

## What we deliberately did NOT build

- Live quotes from providers (their calculators are deliberately closed; we compare published,
  auditable data instead — see [prior art research](docs/research/03-prior-art.md))
- User accounts (anonymous alert emails only, from M4)
- A server runtime — the workload is static by construction (quarterly data, fixed amounts;
  see [ADR-0005](docs/adr/0005-github-pages-static-export.md))
- Any affiliate/referral mechanism whatsoever
- Pre-2016 legacy workbook support (different schema, low value)

## Data provenance

| Dataset | Source | License | Refresh |
|---|---|---|---|
| Remittance Prices Worldwide | [World Bank Data Catalog #0037898](https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide) | CC BY 4.0 | Quarterly |
| FX reference rates | [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) | CC0 1.0 | Daily |

Full provenance policy — source, license, refresh mechanism, and every upstream
data quirk we handle — lives in [`docs/data-provenance.md`](docs/data-provenance.md).

## Team & process

Maintained by [@viji-saravanan](https://github.com/viji-saravanan) with
[@callmearya](https://github.com/callmearya). `main` is protected: everything merges through
reviewed PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

## License

Code: MIT ([LICENSE](LICENSE)). Upstream data: CC BY 4.0, © The World Bank — RemitWatch is
not affiliated with the World Bank or any transfer provider.
