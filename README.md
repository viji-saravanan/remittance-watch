# RemitWatch

> Send $200 home and know what it *really* costs before you pick a provider.
> Ranks money-transfer services by true total cost — the visible fee **plus** the margin
> hidden inside the exchange rate — using the World Bank's open pricing data.
> No affiliate links. The ranking cannot be bought.

**Status:** M0 shipped — [live on GitHub Pages](https://viji-saravanan.github.io/remittance-watch/);
data pipeline lands in M1.
[Build log →](https://github.com/viji-saravanan/remittance-watch/issues?q=milestone%3A%22M0%22)

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
container (lands with M1).

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

Full provenance policy lands with M1 in `docs/data-provenance.md`.

## Team & process

Maintained by [@viji-saravanan](https://github.com/viji-saravanan) with
[@callmearya](https://github.com/callmearya). `main` is protected: everything merges through
reviewed PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

## License

Code: MIT ([LICENSE](LICENSE)). Upstream data: CC BY 4.0, © The World Bank — RemitWatch is
not affiliated with the World Bank or any transfer provider.
