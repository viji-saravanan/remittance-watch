# Contributing to RemitWatch

Thanks for your interest. This project has two hard rules before anything else:

## The ethics charter (read this first)

1. **No affiliate links, ever.** Ranking is by true cost — fee + FX margin — and nothing else.
   No paid placement, no referral codes, no "featured" providers. If someone offers us money
   to rank higher, we publish the email.
2. **Methodology is public.** Every number shown can be traced to the World Bank's
   Remittance Prices Worldwide database and our documented transformation of it. If you can't
   reproduce a number from the source data, that's a bug.
3. **We aggregate official data only.** No scraping commercial comparator sites.

Changes that violate any of the above will be rejected regardless of code quality.

## Process

```
issue → branch → PR → review by the other maintainer → squash merge → main
```

- `main` is protected: no direct pushes, no force pushes, conversation resolution required.
- Open or claim an issue **before** writing code; PRs reference their issue (`Closes #N`).
- Branch names: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
- CI must pass (lint + build + tests) before merge.

## Commit conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` — present tense, imperative, ≤72 chars.
- Co-author trailers are used sparingly and honestly — only when a person genuinely contributed
  to the change. Review attribution happens in the PR itself, not the trailer.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # unit + contract tests
```

Postgres runs as an ephemeral container — local docker or the CI service container. It is a
pipeline workspace, never a hosted dependency; see `docs/adr/` for the current decisions.

## Data contributions

Found an error in our parsed data? Check it against the [source workbook](https://remittanceprices.worldbank.org)
first — if we differ from the source, open a `fix:` issue with both values and the quarter.
