# Architecture Decision Records

Immutable once accepted; superseded by writing a new ADR that references its predecessor.

| # | Decision | Status |
|---|---|---|
| [0001](0001-toolchain-split.md) | TypeScript app (Next.js 15/drizzle) + Python ingestion (uv/openpyxl) | accepted |
| [0002](0002-data-source-and-schema.md) | Parse Data Catalog workbook; schema v1; non-transparent providers flagged & excluded by default | accepted |
| [0003](0003-fx-rate-source.md) | exchange-api primary chain; snapshot-first; open.er-api runtime-only | accepted |
| [0004](0004-deploy-and-environments.md) | Vercel Hobby + Neon free + Actions cron; preview-per-PR | superseded by [0005](0005-github-pages-static-export.md) |
| [0005](0005-github-pages-static-export.md) | GitHub Pages static export, zero servers; Postgres demoted to CI workspace | accepted |
| [0006](0006-motion-and-icon-stack.md) | GSAP scroll-story motion (Standard license) + lucide-react icons; progressive-enhancement + mobile-first contract | accepted |
| [0007](0007-ranking-policy-negative-costs.md) | Rank published costs verbatim; flag negative margins ("rate advantage"); non-transparent never ranked; $200/$500 tiers only | accepted |
| [0008](0008-explorer-data-artifact.md) | Explorer reads one versioned JSON bundle (`/data/rpw-explorer-v1.json`), fetched client-side | accepted |

Grounding evidence for 0001–0006: [`../research/`](../research/) (verified 2026-08-22/23).
