# RemitWatch

> Send $200 home — know exactly what it costs before you choose. A transparent, open-source
> comparison of the **true total cost** of remittances: fees *and* the FX margin providers hide
> inside the exchange rate.

**Status:** 🚧 under active development — M0 (bootstrap) in progress. This README is a placeholder;
the full product README (problem, demo, quickstart, architecture) lands with the first deployable.

- **Data:** World Bank [Remittance Prices Worldwide](https://remittanceprices.worldbank.org)
  (quarterly, free) + ECB reference FX rates.
- **License:** MIT. **Data license:** see `docs/data-provenance.md` (landing with M1).
- **Principles:** no affiliate links, ever · rank by true cost · methodology fully public.

## Repository map

```
docs/            product framing, ADRs, data provenance, methodology
app/             Next.js application (lands in M0)
pipeline/        ingestion + normalization (lands in M1)
tests/           fixtures + contract tests (lands in M1)
```

Maintained by [@viji-saravanan](https://github.com/viji-saravanan) with
[@callmearya](https://github.com/callmearya). Contributions welcome — read `CONTRIBUTING.md`
(landing with M2) and open an issue first.
