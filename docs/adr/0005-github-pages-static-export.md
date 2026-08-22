# ADR-0005 · Deploy & serving: GitHub Pages static export — zero servers

- Status: accepted · Date: 2026-08-22 · Supersedes: [0004](0004-deploy-and-environments.md) · Deciders: viji-saravanan, callmearya

## Context

ADR-0004 put the app on Vercel Hobby and the database on Neon free. Re-examined against the
actual workload before wiring deploy, it fails a simple test: **nothing in RemitWatch needs to
compute at request time.**

- RPW data changes quarterly and amounts are fixed ($200/$500 — what RPW publishes), so every
  page and API response can be rendered *at ingest time*.
- The API's audience is researchers and journalists; they value stable, citable endpoints.
  Static JSON regenerated at each quarterly ingest — versioned by git tag — serves that
  audience better than a live server.
- The FX overlay (M4) is a browser-side fetch of a CC0 CDN; alerts are Actions cron.
- A Node server would sit idle forever, and Vercel Hobby carries a non-commercial license
  clause plus two extra accounts (Vercel, Neon) for capabilities we would never use
  (ISR, edge functions, middleware, preview URLs at a two-person review cadence).

## Options

| Option | For | Against |
|---|---|---|
| **GitHub Pages + Actions (static export)** | Zero accounts beyond GitHub; no servers; git-auditable artifacts; no license caveats | No per-PR preview URLs; subpath hosting until a custom domain |
| Keep ADR-0004 (Vercel + Neon) | Zero migration; preview-per-PR | Two accounts and a license clause to serve files that never change |
| Cloudflare Pages (OpenNext adapter) | Generous free tier | Adapter friction for an app with zero runtime compute |
| Fly.io / Render containers | Full control | Free tiers have shrunk; ops surface we don't need |

## Decision

- **Hosting:** GitHub Pages project site, deployed by Actions
  (`configure-pages@v6` → `upload-pages-artifact@v5` → `deploy-pages@v5`) on every push to
  `main`. Artifact deploys never run Jekyll — no `.nojekyll` anywhere.
- **Build:** Next.js `output: 'export'`, `trailingSlash: true` (documented-safe URL
  resolution on Pages), `images: { unoptimized: true }`, and `basePath` derived from
  `actions/configure-pages`' `base_path` output (default `/remittance-watch`) so repo
  renames can't silently 404 assets. Fonts self-host at build time; no browser hits Google.
- **Postgres is demoted to a per-run transform workspace** — a CI service container (and
  local docker), never a serving dependency and never a hosted account. The serving source
  of truth is versioned artifacts committed to the repo (JSON under `/v1/`, regenerated at
  each quarterly ingest). ADR-0002's schema v1 is unchanged; ADR-0004's own exit hatch
  (drizzle migrations are plain, portable SQL) is what makes this swap free.
- **Serving model:** M2 corridor pages pre-render at build; M3's API is static JSON
  (`/v1/corridors/{from}/{to}.json`) on the Pages CDN; M4's FX overlay fetches the CC0 rate
  CDN client-side with the feed date surfaced in UI; alerts stay Actions-side (email
  provider: future ADR).
- **Secrets:** unchanged from 0004 — `gh secret set` only, least privilege. In practice the
  deploy path needs no secrets at all: GITHUB_TOKEN plus OIDC.

## Consequences

- Zero accounts beyond GitHub; zero servers; nothing to log into, nothing to expire.
- The data and API become git-auditable artifacts — every published number is diffable in a
  commit. This *is* the project's thesis.
- No per-PR previews: review relies on CI building every PR plus local `npm run dev`.
  Accepted at a two-maintainer cadence.
- Locked to `viji-saravanan.github.io/remittance-watch/` until a custom domain; revisit
  basePath then (one-line change + rebuild).
- If request-time compute is ever genuinely needed (arbitrary amounts, server-side search),
  that is a new ADR — most likely a Cloudflare Worker in front of the static site.
- Limits (public repos): 1 GB published site, 100 GB/mo soft bandwidth, 10-min deploy
  timeout; the builds-per-hour cap does not apply to Actions workflows. Our artifacts are
  KBs; what breaks first at 10× is bandwidth — everything is CDN-cached and quarterly.
- What we deliberately did NOT build: preview-deploy infrastructure, any server runtime,
  rate limiting (a static CDN doesn't need our help), custom-domain wiring.
