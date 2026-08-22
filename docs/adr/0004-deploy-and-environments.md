# ADR-0004 · Deploy & environments: Vercel Hobby + Neon free + Actions cron

- Status: accepted · Date: 2026-08-22 · Deciders: viji-saravanan, callmearya

## Context

Constraints: zero infrastructure budget (workspace charter), PR-based trunk (branch protection
live), quarterly batch jobs, small read-heavy public site + API. Project is non-commercial OSS.

## Options

| Option | For | Against |
|---|---|---|
| Cloudflare Pages | Generous free tier | Next.js SSR on CF Workers adds adapter friction |
| Fly.io / Render containers | Full control | Free tiers have shrunk; ops surface we don't need |
| **Vercel Hobby + Neon free Postgres** | First-class Next.js; preview deploy per PR (matches PR-trunk flow); Neon branches map to envs; zero-config cron via Actions | Hobby license is non-commercial — fine here, revisit if project commercializes |

## Decision

- **App/API:** Vercel Hobby. Every PR gets an ephemeral preview URL; `main` auto-deploys prod.
- **Postgres:** Neon free tier — `main` branch = production; `dev` branch for local/CI runs.
  Connection string lives in Vercel env vars and repo *variables* (not secrets-in-git).
- **Cron (quarterly ingest, daily FX pull):** GitHub Actions scheduled workflows writing to Neon.
  No always-on worker exists anywhere in this architecture.
- **Secrets:** `gh secret set` only; least-privilege tokens; rotation documented in runbook.

## Consequences

- Preview-per-PR makes review concrete: reviewers see the actual change rendered.
- What breaks first at 10×: Neon compute hours on heavy crawl traffic → mitigation is aggressive
  edge caching of corridor pages (they change quarterly); documented in M2 acceptance.
- Exit hatch: drizzle migrations are plain SQL → portable to any managed Postgres without rework.
