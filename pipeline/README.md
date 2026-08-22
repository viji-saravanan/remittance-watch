# RemitWatch ingestion pipeline

Turns the World Bank's [Remittance Prices Worldwide](https://datacatalog.worldbank.org/search/dataset/0037898)
quarterly workbook into a clean, tested Postgres dataset — one command, idempotent,
loud about upstream drift. Provenance and every known upstream data quirk:
[`docs/data-provenance.md`](../docs/data-provenance.md).

```
rw-ingest migrate   apply pending schema migrations
rw-ingest fetch     resolve + download the current release (sha256 recorded to var/provenance.log)
rw-ingest ingest    migrate + parse + load (pass --file PATH or --download)
rw-ingest verify    acceptance checks against the loaded data
```

## Quickstart

```bash
docker compose -f pipeline/docker-compose.yml up -d   # ephemeral transform DB (port 5433)
cd pipeline
uv sync                                               # installs the locked environment
DATABASE_URL=postgres://rw:rw@localhost:5433/rw uv run rw-ingest ingest --file <workbook.xlsx>
DATABASE_URL=postgres://rw:rw@localhost:5433/rw uv run rw-ingest verify
```

Tests: `uv run pytest` — unit + contract tests run anywhere; e2e tests self-provision a
throwaway `rw_test` database and skip cleanly when no Postgres is reachable.

## Design notes

- **Streaming parse.** The 48 MB workbook uncompresses to ~300 MB; openpyxl runs in
  `read_only` mode row by row — nothing is materialized.
- **Idempotent load.** Each source row's full 42-cell content is hashed; quotes are keyed
  on `(raw_row_hash, tier)`. Re-ingesting the same file changes nothing; a corrected file
  updates rows in place, and rows that disappeared from ingested quarters are reaped.
- **Loud contract.** Sheet name, exact 42-column header, and required fields raise
  `FormatDrift` on any deviation. The fee/FX decomposition identity is audited per tier:
  violations are *recorded* with published values kept verbatim (the WB's number stays
  authoritative), and the CLI fails only when the violation rate crosses 1% — 50× the
  observed baseline of ~0.02% (`--strict` aborts on the first violation instead).
- **NUMERIC end to end.** Money never touches a float until Python's `Decimal` hands it to
  Postgres `numeric`.
- **One transaction per ingest.** Staged via `COPY` into a temp table, upserted, reconciled;
  any failure rolls the whole run back.

## Container

The pipeline ships as its own image (published to `ghcr.io/viji-saravanan/rw-ingest` by CI):

```bash
docker build -t rw-ingest pipeline/
docker run --rm --network host \
  -e DATABASE_URL=postgres://rw:rw@localhost:5433/rw \
  -v "$PWD/var:/app/var" \
  rw-ingest ingest --file var/rpw.xlsx
```
