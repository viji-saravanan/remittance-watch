# ADR-0001 · Toolchain: TypeScript app + Python ingestion pipeline

- Status: accepted · Date: 2026-08-22 · Deciders: viji-saravanan, callmearya

## Context

Two workloads with different shapes:

1. **Web app + API** — SSR pages, JSON endpoints, design work. Ecosystem gravity: TypeScript.
2. **Ingestion** — stream-parse a 48 MB xlsx whose main sheet uncompresses to ~298 MB
   (research §01), normalize messy instrument strings, upsert ~204k rows quarterly.

## Options

| Option | For | Against |
|---|---|---|
| A. All TypeScript (exceljs / SheetJS for xlsx) | One language, one CI | Streaming-read reliability on *this specific* 300 MB-sheet file unproven to us; SheetJS install path has had supply-chain oddities |
| B. Python pipeline (`openpyxl read_only`) + TS app | Research **literally verified** openpyxl streaming on the real file; pandas-free stdlib+psycopg keeps it lean | Two runtimes in CI; two dependency manifests |
| C. Rust/Go ingestion | Fastest parse | Overengineering: a quarterly batch job's runtime is irrelevant at this scale |

## Decision

**B.** `app/` = Next.js 15 + TypeScript + Tailwind CSS v4 + drizzle-kit (SQL-visible migrations).
`pipeline/` = Python 3.12 managed by **uv**, openpyxl streaming reader, psycopg writes.
One language where users are (the web), one language where the proof is (the parser).

## Consequences

- CI runs both toolchains (Node 20 job + uv job) — acceptable cost, isolated steps.
- Shared truth lives in Postgres, not code — no cross-language type sharing needed.
- What breaks first at 10×: nothing user-facing; ingest runtime grows linearly (~minutes), fine.
- Revisit trigger: if openpyxl chokes on future workbook drift, re-evaluate calamine(Rust)/python binding.
