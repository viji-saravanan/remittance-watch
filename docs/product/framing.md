# Product framing · RemitWatch

> Grounded in Jobs-to-be-Done. Status: **hypothesis-grade** — built from verified market data
> and prior-art analysis, not yet from user interviews. Every assumption is labeled; the first
> real users either confirm or kill them.

## The job story

**When** I need to send money home to my family,
**I want to know what each provider will actually cost me — fees plus the margin hidden in the
exchange rate —**
**so I** can keep the most money possible in my family's hands, and feel like a competent
provider rather than a mark.

## Who has this job

1. **Migrant workers sending regular remittances** — 304M international migrants (UN DESA 2024);
   flows to LMICs ≈ $685B/yr, India receiving $129B, more than any other country.
   Functional job: choose provider per transfer. Emotional job: feel the sacrifice is worth it;
   avoid the shame of being quietly overcharged.
2. **The families receiving** — they see arrival amounts, never fee breakdowns; can't audit what
   was lost en route.
3. **NGOs / researchers / journalists** covering financial inclusion — need citable corridor
   numbers without scraping Excel workbooks (functional job only).

Segments 1–2 are beneficiaries; segment 3 gives the project reach and legitimacy.

## Pains, ranked by intensity

| # | Pain | Intensity | Evidence |
|---|---|---|---|
| 1 | **Hidden FX margin** — "zero-fee" offers that are the costliest | Acute: ~half the true cost on many corridors | RPW decomposes it; comparators don't show it |
| 2 | Comparison tools rank by commission, not by cost | Acute | Monito/CompareRemit affiliate models (research §03) |
| 3 | Numbers can't be trusted or verified | High | Closed data everywhere; no methodology published |
| 4 | Corridor coverage gaps (smaller diaspora corridors ignored) | Medium | CompareRemit covers 7 receive countries |
| 5 | Not knowing costs vary quarter to quarter | Medium | No alerting exists anywhere for price drops |

## Gains sought

- Know the *true total* before committing to a transfer (expectation)
- Save 2–4% per transfer vs default choice — $12–24 on every $500 (savings; SDG 10.c target context)
- Trust numbers because method + source are public and checkable (adoption factor)
- Hear when "my corridor gets cheaper" without re-checking monthly (life improvement)

## Alternatives users hire today

Ask family/friends ("which one do you use?") → Google "cheapest way to send money to X" →
land on affiliate comparator → pick #1 → never revisit. Our competition is mostly *habit*,
which means: win the search moment with honest answers, and earn revisits via alerts.

## Hypotheses to validate (kill criteria included)

| # | Hypothesis | How we'd know we're wrong |
|---|---|---|
| H1 | People choosing remittance providers will consult a true-cost ranking if it ranks high in their search moment | Launch posts get traffic but zero corridor-page depth (>80% bounce) → kill or pivot to API-first |
| H2 | Showing fee vs FX-margin decomposition changes perceived value vs existing comparators | Qualitative feedback can't articulate the difference → simplify messaging to plain totals |
| H3 | Researchers/journalists want an open API over RPW | Zero API usage after launch outreach → drop M3 emphasis |

## Success metrics (product, not vanity)

- Corridor pages viewed per visitor ≥ 2 (they're comparing, not bouncing)
- ≥ 3 independent citations of our data/API by researchers or press within 6 months of launch
- Alert subscribers who keep ≥ 1 active watch after 30 days ≥ 40%
- A published number survives external reproduction attempts unchallenged

## Non-goals

Real-time quotes · payments/PSP features of any kind · provider accounts/logins beyond anonymous
alert emails · covering providers outside RPW's dataset while claiming completeness ·
advice on legality/tax of transfers.

## Positioning statement

For people sending money home who don't trust comparison sites, **RemitWatch** ranks providers by
what transfers actually cost — including the exchange-rate margin others hide — using the World
Bank's open pricing data, with no affiliate links ever. Unlike Monito or CompareRemit, our ranking
cannot be bought, and our methodology page shows exactly why.
