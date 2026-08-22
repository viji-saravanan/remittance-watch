# Research · RPW dataset ground truth

> Verified 2026-08-22 by direct download + openpyxl inspection. Raw evidence:
> [`raw-grounding-workflow-output.json`](./raw-grounding-workflow-output.json).

## Access path (the one that works)

| Route | Status |
|---|---|
| remittanceprices.worldbank.org | ❌ Cloudflare JS challenge — HTTP 403 to all non-browser clients, including files |
| World Bank API (SI.RMT.COST.OB.ZS) | ❌ stale since 2020-12; **no corridor-level source at all** |
| **Data Catalog dataset [0037898](https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide)** | ✅ the programmatic mirror |

Verified download (HTTP 200, curl + browser UA):

```
https://datacatalogfiles.worldbank.org/ddh-published/0037898/DR0095523/rpw_dataset_2011_2025_q3.xlsx
```

50,762,620 bytes. Latest confirmed release: **Q3 2025 = Issue No. 54 (Sept 2025)**,
global average cost **6.36%**. No later issue verifiable as of 2026-08-22.
⚠️ The `DDH-published` resource ID (`DR0095523`) may change per release — the ingest must
resolve it from the catalog page/API, not hardcode it.

## Workbook structure (verified by opening the file)

Six sheets: `Terms of Use`, `Methodology` (empty), `Legend` (data dictionary),
`Countries`, `Dataset (up to Q1 2016)` (legacy schema), **`Dataset (from Q2 2016)`** ← main.

Main sheet: ONE header row, **42 named columns**, **204,469 rows**, quarters
`2016_2Q … 2025_3Q` (37 quarters; note **`2025_2Q` does not exist** — no collection round).

Column groups:

```
id, period,
source_code, source_name, source_region, source_income, source_lending, source_G8G20,
destination_code, destination_name, destination_region, destination_income, …,
firm, firm_type, payment instrument, access point, speed actual,
cc1 lcu amount, cc1 denomination amount, cc1 lcu code, cc1 lcu fee, cc1 lcu fx rate, cc1 fx margin, cc1 total cost %,
cc2 …(same block for $500),
inter lcu bank fx, transparent, Standard Note, note2,
receiving network coverage, pickup location, pickup method, date, corridor
```

Key semantics:

- **One row = provider × corridor × quarter × instrument combo.** Instruments are row attributes
  (free-form comma strings — 26 distinct combos like `'Cash'`, `'Cash,Mobile money'`), NOT columns.
- **Two amount tiers as parallel column blocks**: `cc1` = USD 200, `cc2` = USD 500. Nothing else.
- Corridor = ISO-alpha-3 concat (`source_code` + `destination_code`, e.g. `AGONAM`).
- **Cost math verified numerically:** `total cost % = fee/amount×100 + fx margin`
  (e.g. 2257.2 AOA on 33,000 AOA → 6.84% + 3.10% = 9.94%). Interbank reference in `inter lcu bank fx`.
- **Non-transparent providers:** `transparent='no'` ⇒ fx margin stored as literal 0 with a note
  saying 0 ≠ no cost. WB excludes them from its averages — **we must flag them and exclude from
  default rankings too** (with a visible toggle), or we'd publish false "0% margin" numbers.

## Data-quality gotchas (ingestion must handle)

1. Q3-2025 rows carry unlabeled trailing columns 43–47 (`2025`, `'AGO2025'`…) — expect drift.
2. Legacy sheet has a different schema (`product`/`sending location` vs `payment instrument`);
   different `id` format. **Out of scope for MVP** — current sheet only.
3. Instrument casing inconsistent (`'Credit Card'` vs `'Credit card'`) — normalization map required.
4. 48 MB xlsx whose main sheet XML uncompresses to ~298 MB — **must stream**
   (`openpyxl read_only=True`) and convert to Parquet/CSV once.

Latest quarter cardinality: ~6,470 rows, ~400 firms, ~348 corridors
(catalog metadata overall: 377 corridors, 48 sending / 111 receiving countries).

## License

Catalog labels the dataset **CC BY 4.0** ("The World Bank: Remittance Prices Worldwide" attribution;
adaptation/republish OK incl. commercial). The workbook's legacy `Terms of Use` tab links dead
shorteners, one labeled "Restricted Data" — treat the **catalog's CC BY 4.0 label as authoritative**
and record this discrepancy in `docs/data-provenance.md`.
