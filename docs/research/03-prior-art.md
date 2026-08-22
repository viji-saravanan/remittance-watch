# Research · Prior art & the gap

> Sweep date 2026-08-22. Method: GitHub REST API across 9 query angles + direct repo inspection
> + live probes of comparator sites.

## The landscape

| Player | Model | Open? | Verdict for us |
|---|---|---|---|
| **Monito** | Affiliate commissions + ads/paid "Partner Spotlights" (claims neutrality via "Monito Score"); 200+ providers / 154 countries | ❌ closed, Cloudflare-blocked | The incumbent we structurally differ from |
| **CompareRemit** | Affiliate lead-gen (Xoom, Remitly…); narrow diaspora corridors (US/UK/CA/AU → South Asia, PH, MX) | ❌ closed | Same model, narrower |
| **Wise compare pages** | Self-interested but discloses zero commissions; tables "for marketing purposes only"; mystery-shopped quotes vs Bloomberg mid | ❌ not a reusable dataset | Honesty outlier; owns affiliate site Exiap anyway |
| World Bank consumer tool | ~367 corridors UI on RPW data; **API stale since Dec 2020**; GitHub repo an empty placeholder | Data ✅ CC BY 4.0, tooling ❌ | Our upstream, not competitor |
| GitHub OSS attempts | Best: ManuelBv/remittance-price-comparison (true-cost concept, but only Wise integration real — others JS-walled); coinnect (6★, different problem: multi-hop crypto routing); ilyabo/remittances (15★, flows-not-prices, dead since 2018). **Nothing >15★, none maintained** | — | The niche is empty |

## The gap (verified, four conditions no existing asset meets)

1. Programmatic ingestion of CC BY 4.0 RPW data
2. Ranking by decomposed **true cost = fee + hidden FX margin**
3. Zero-affiliate funding model with published methodology
4. Public API over the result

## Hard constraints discovered (feed our charter & ADRs)

- **Do not scrape comparators** — Monito/WB sites return 403 behind Cloudflare; ToS-hostile; would
  undermine the entire positioning.
- **Do not reverse-engineer provider quote endpoints** — Remitly/WorldRemit/Xoom render prices
  client-side deliberately (documented first-hand in prior art's README). Wise's documented quote
  API is the one legitimate future integration candidate (post-v1, needs its own ADR).
- **Never present quarterly snapshots as live quotes** — that's precisely the misleading pattern
  we critique. As-of dates everywhere.
- **Scope claims to the dataset**: RPW skews to established MTO/bank/postal players; digital-first
  fintechs and newer corridors are under-represented. Say what the data covers, nothing more.
- Nearly all failed prior art shipped **without a license** — ours is MIT from commit one.
