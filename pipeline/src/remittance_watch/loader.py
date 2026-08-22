"""Idempotent load: parsed SourceRows -> normalized schema (schema v1).

Strategy: one transaction per ingest. Dimension rows are resolved through
in-memory caches (the workbook has ~400 firms, ~350 corridors, ~150 countries —
trivially cacheable); quote rows are batch-COPYied into a session-local staging
table and upserted on ``(raw_row_hash, tier_source)``, so re-ingesting the same
workbook is a no-op and a corrected workbook updates in place.

Non-transparent providers: the source stores their FX margin as a literal 0
with a note saying 0 ≠ no cost. We store NULL instead and keep
``transparent=false`` so default rankings can exclude them (ADR-0002).
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
import sys

from psycopg import Connection

from .parser import CountryRef, SourceRow

# Progress heartbeat interval (source rows) — the full workbook takes minutes
# on a bind-mounted volume, and silence reads as a hang.
PROGRESS_EVERY = 50_000

STAGE_DDL = """
CREATE TEMP TABLE stage_quotes (
    quarter_id        INTEGER NOT NULL,
    corridor_id       BIGINT NOT NULL,
    provider_id       BIGINT NOT NULL,
    firm_type         TEXT,
    instrument        TEXT NOT NULL DEFAULT '',
    access_point      TEXT,
    speed_actual      TEXT,
    amount_usd        NUMERIC NOT NULL,
    currency_code     TEXT,
    lcu_amount        NUMERIC,
    fee_lcu           NUMERIC,
    fx_rate           NUMERIC,
    interbank_fx_rate NUMERIC,
    fx_margin_pct     NUMERIC,
    total_cost_pct    NUMERIC,
    transparent       BOOLEAN NOT NULL,
    note              TEXT,
    raw_row_hash      TEXT NOT NULL,
    tier_source       TEXT NOT NULL
) ON COMMIT DROP
"""

STAGE_COLUMNS = (
    "quarter_id, corridor_id, provider_id, firm_type, instrument, access_point, "
    "speed_actual, amount_usd, currency_code, lcu_amount, fee_lcu, fx_rate, "
    "interbank_fx_rate, fx_margin_pct, total_cost_pct, transparent, note, "
    "raw_row_hash, tier_source"
)

UPSERT_SQL = f"""
INSERT INTO quotes (
    quarter_id, corridor_id, provider_id, firm_type, instrument, access_point,
    speed_actual, amount_usd, currency_code, lcu_amount, fee_lcu, fx_rate,
    interbank_fx_rate, fx_margin_pct, total_cost_pct, transparent, note,
    raw_row_hash, tier_source
)
SELECT quarter_id, corridor_id, provider_id, firm_type, instrument, access_point,
       speed_actual, amount_usd, currency_code, lcu_amount, fee_lcu, fx_rate,
       interbank_fx_rate, fx_margin_pct, total_cost_pct, transparent, note,
       raw_row_hash, tier_source
FROM stage_quotes
ON CONFLICT (raw_row_hash, tier_source) DO UPDATE SET
    firm_type         = EXCLUDED.firm_type,
    instrument        = EXCLUDED.instrument,
    access_point      = EXCLUDED.access_point,
    speed_actual      = EXCLUDED.speed_actual,
    amount_usd        = EXCLUDED.amount_usd,
    currency_code     = EXCLUDED.currency_code,
    lcu_amount        = EXCLUDED.lcu_amount,
    fee_lcu           = EXCLUDED.fee_lcu,
    fx_rate           = EXCLUDED.fx_rate,
    interbank_fx_rate = EXCLUDED.interbank_fx_rate,
    fx_margin_pct     = EXCLUDED.fx_margin_pct,
    total_cost_pct    = EXCLUDED.total_cost_pct,
    transparent       = EXCLUDED.transparent,
    note              = EXCLUDED.note
"""

BATCH_ROWS = 20_000

# Per-quarter reconciliation: after upserting, drop quotes belonging to quarters
# present in this workbook whose row-hash no longer exists upstream. This is how
# WB corrections and row removals flow in — a revised row has a NEW hash, so the
# stale identity is reaped instead of lingering beside it.
RECONCILE_SQL = """
DELETE FROM quotes q
USING (SELECT DISTINCT quarter_id FROM stage_quotes) s
WHERE q.quarter_id = s.quarter_id
  AND NOT EXISTS (
      SELECT 1 FROM stage_quotes st
      WHERE st.raw_row_hash = q.raw_row_hash
        AND st.tier_source = q.tier_source
  )
"""


@dataclass(slots=True)
class IngestStats:
    source_rows: int = 0
    quote_rows: int = 0
    skipped_tiers: int = 0
    quarters: set[int] = field(default_factory=set)

    def summary(self) -> str:
        quarters = ", ".join(str(q) for q in sorted(self.quarters))
        return (
            f"{self.source_rows} source rows -> {self.quote_rows} quotes "
            f"({self.skipped_tiers} empty tiers skipped); quarters: {quarters}"
        )


def ingest_rows(conn: Connection, rows: Iterable[SourceRow]) -> IngestStats:
    """Load rows inside a single transaction; the caller closes the connection.

    synchronous_commit is relaxed for this connection only: the transform
    database is disposable (ADR-0005), so crash-durability buys nothing —
    but it costs a lot on slow-fsync mounts. Atomicity (all-or-nothing per
    ingest) is untouched.
    """
    conn.execute("SET synchronous_commit TO OFF")
    stats = IngestStats()
    with conn.transaction():
        stats = _ingest(conn, rows, stats)
    return stats


def _ingest(conn: Connection, rows: Iterable[SourceRow], stats: IngestStats) -> IngestStats:
    known_countries: set[str] = {
        iso3 for (iso3,) in conn.execute("SELECT iso3 FROM countries").fetchall()
    }
    corridor_ids: dict[str, int] = _pairs(conn, "corridors", "code", "id")
    provider_ids: dict[str, int] = _pairs(conn, "providers", "name", "id")
    quarter_seen: set[int] = set()

    cur = conn.cursor()
    cur.execute(STAGE_DDL)

    pending_stage: list[tuple] = []

    def flush_stage() -> None:
        if not pending_stage:
            return
        with cur.copy(f"COPY stage_quotes ({STAGE_COLUMNS}) FROM STDIN") as copy:
            for record in pending_stage:
                copy.write_row(record)
        cur.execute(UPSERT_SQL)
        stats.quote_rows += len(pending_stage)
        pending_stage.clear()

    for row in rows:
        stats.source_rows += 1
        if stats.source_rows % PROGRESS_EVERY == 0:
            print(
                f"  … {stats.source_rows:,} source rows, "
                f"{stats.quote_rows:,} quotes staged",
                file=sys.stderr,
                flush=True,
            )
        if row.period not in quarter_seen:
            _quarter_upsert(cur, row.period)
            quarter_seen.add(row.period)
        stats.quarters.add(row.period)

        source_iso3 = _country_id(cur, known_countries, row.source)
        dest_iso3 = _country_id(cur, known_countries, row.destination)
        corridor_id = _corridor_id(cur, corridor_ids, source_iso3, dest_iso3)
        provider_id = _provider_id(cur, provider_ids, row.firm)

        for tier_name, tier in row.tiers():
            if tier.is_empty():
                stats.skipped_tiers += 1
                continue
            margin = tier.fx_margin_pct if row.transparent else None
            pending_stage.append(
                (
                    row.period,
                    corridor_id,
                    provider_id,
                    row.firm_type,
                    row.instrument,
                    row.access_point,
                    row.speed_actual,
                    tier.denomination_usd,
                    tier.currency,
                    tier.lcu_amount,
                    tier.fee_lcu,
                    tier.fx_rate,
                    row.interbank_fx_rate,
                    margin,
                    tier.total_cost_pct,
                    row.transparent,
                    row.note,
                    row.raw_row_hash,
                    tier_name,
                )
            )
            if len(pending_stage) >= BATCH_ROWS:
                flush_stage()

    flush_stage()
    cur.execute(RECONCILE_SQL)
    cur.close()
    return stats


def _pairs(conn: Connection, table: str, key_col: str, val_col: str) -> dict[str, object]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {key_col}, {val_col} FROM {table}")  # noqa: S608 — identifiers are literals above
        return {k: v for k, v in cur.fetchall()}


def _country_id(cur, known: set[str], ref: CountryRef) -> str:
    """Ensure the country row exists; countries are identified by iso3 itself."""
    if ref.iso3 in known:
        return ref.iso3
    cur.execute(
        """
        INSERT INTO countries (iso3, name, region, income_level, lending_category, g8g20)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (iso3) DO UPDATE SET
            name             = EXCLUDED.name,
            region           = COALESCE(EXCLUDED.region, countries.region),
            income_level     = COALESCE(EXCLUDED.income_level, countries.income_level),
            lending_category = COALESCE(EXCLUDED.lending_category, countries.lending_category),
            g8g20            = COALESCE(EXCLUDED.g8g20, countries.g8g20)
        """,
        (ref.iso3, ref.name, ref.region, ref.income, ref.lending, ref.g8g20),
    )
    known.add(ref.iso3)
    return ref.iso3


def _corridor_id(cur, cache: dict[str, int], source_iso3: str, dest_iso3: str) -> int:
    code = f"{source_iso3}{dest_iso3}"
    hit = cache.get(code)
    if hit is not None:
        return hit
    cur.execute(
        """
        INSERT INTO corridors (source_iso3, dest_iso3, code)
        VALUES (%s, %s, %s)
        ON CONFLICT (code) DO NOTHING
        """,
        (source_iso3, dest_iso3, code),
    )
    cur.execute("SELECT id FROM corridors WHERE code = %s", (code,))
    cid = cur.fetchone()[0]
    cache[code] = cid
    return cid


def _provider_id(cur, cache: dict[str, int], name: str) -> int:
    hit = cache.get(name)
    if hit is not None:
        return hit
    cur.execute(
        "INSERT INTO providers (name) VALUES (%s) ON CONFLICT (name) DO NOTHING",
        (name,),
    )
    cur.execute("SELECT id FROM providers WHERE name = %s", (name,))
    pid = cur.fetchone()[0]
    cache[name] = pid
    return pid


def _quarter_upsert(cur, period: int) -> None:
    year, qtr = divmod(period, 10)
    cur.execute(
        """
        INSERT INTO quarters (id, year, qtr, label) VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (period, year, qtr, f"{year}_{qtr}Q"),
    )
