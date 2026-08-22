# Research · FX rate sources (all tested live 2026-08-22)

> Decision taken from these findings lives in [`../adr/0003-fx-rate-source.md`](../adr/0003-fx-rate-source.md).

## Recommendation (verified)

**PRIMARY: [`fawazahmed0/exchange-api`](https://github.com/fawazahmed0/exchange-api)**
(successor of currency-api) — static JSON over CDN, **no key, no rate limits**,
**341 currencies** (covers every corridor currency we need: INR, PHP, NGN, PKR, BDT, ETB, VND…),
daily updates, **CC0-1.0** — the only candidate licensed unambiguously enough to let us store
and serve derived values at global coverage.

```
https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{latest|YYYY-MM-DD}/v1/currencies/usd.min.json
fallback (README mandates implementing it): https://{date}.currency-api.pages.dev/v1/{endpoint}
```

⚠️ Response shape changed vs old repo: `json[from][to]`. jsDelivr `@latest` can lag a day behind
pages.dev — **always read the embedded `date` field, never assume today**.

## Chain

| Tier | Source | Notes |
|---|---|---|
| 1 | exchange-api via jsDelivr → pages.dev | primary + mandated fallback |
| 2 | `open.er-api.com/v6/latest/USD` | keyless, 166 fiat, daily; **attribution required AND redistribution forbidden** → runtime fallback only, cache permitted, never persist/serve its rates |
| 3 | Frankfurter v2 (`api.frankfurter.dev`) | cross-check; new v2 blends 84 central banks → 201 currencies; repo now `lineofflight/frankfurter` (MIT); `providers=ECB` gives official reference rates but lacks NGN/PKR/BDT |

## Eliminated / demoted

- **exchangerate.host — DEAD for us:** now apilayer/currencylayer; keyless access returns
  `missing_access_key`; free tier 100 req/month. (Our ideation docs assumed keyless — superseded.)
- **ECB direct feeds** — work keyless but only ~29 currencies daily; useful as authoritative EUR anchor only.

All sources are **mid-market reference rates**, not consumer remittance rates — correct for
computing FX-margin comparisons against RPW's applied rates, and the methodology page must say so.

Architecture shape: daily job pulls `usd.min.json` (+`eur.min.json`) → stores snapshot with embedded
date → computes cross rates locally → chain jsDelivr → pages.dev → open.er-api → Frankfurter.
