-- Schema v1 (ADR-0002): the RPW workbook, normalized.
-- One source row = provider x corridor x quarter x instrument combo, carrying TWO amount
-- tiers as parallel cc1/cc2 column blocks. We split those into one quote row per tier so
-- "corridor X, amount Y" is a plain predicate instead of column arithmetic.
-- Money/percentages are NUMERIC end to end — never float.
-- Idempotency: a quote is identified by the hash of its entire source row + which tier
-- block produced it; re-ingesting the same workbook changes nothing (ADR-0002).

CREATE TABLE quarters (
    id     INTEGER PRIMARY KEY,          -- yyyyn: 20162 … 20253
    year   INTEGER NOT NULL,
    qtr    INTEGER NOT NULL CHECK (qtr BETWEEN 1 AND 4),
    label  TEXT    NOT NULL UNIQUE,      -- source spelling: '2025_3Q'
    UNIQUE (year, qtr)
);

CREATE TABLE countries (
    iso3            TEXT PRIMARY KEY CHECK (iso3 ~ '^[A-Z]{3}$'),
    name            TEXT NOT NULL,
    region          TEXT,
    income_level    TEXT,
    lending_category TEXT,
    g8g20           TEXT                      -- source spells it out; kept verbatim
);

CREATE TABLE providers (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE               -- 'firm' as printed by the WB, trimmed
);

CREATE TABLE corridors (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_iso3 TEXT NOT NULL REFERENCES countries(iso3),
    dest_iso3   TEXT NOT NULL REFERENCES countries(iso3),
    code        TEXT NOT NULL UNIQUE CHECK (code = source_iso3 || dest_iso3),
    UNIQUE (source_iso3, dest_iso3)
);

CREATE TABLE quotes (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quarter_id        INTEGER NOT NULL REFERENCES quarters(id),
    corridor_id       BIGINT NOT NULL REFERENCES corridors(id),
    provider_id       BIGINT NOT NULL REFERENCES providers(id),
    firm_type         TEXT,
    instrument        TEXT NOT NULL DEFAULT '',   -- normalized casing; comma combos preserved
    access_point      TEXT,
    speed_actual      TEXT,
    amount_usd        NUMERIC NOT NULL,           -- 200 (cc1 block) or 500 (cc2 block)
    currency_code     TEXT,                       -- lcu denomination, e.g. 'AOA'
    lcu_amount        NUMERIC,
    fee_lcu           NUMERIC,
    fx_rate           NUMERIC,                    -- provider rate applied to the customer
    interbank_fx_rate NUMERIC,                    -- reference rate; row-level, copied to both tiers
    fx_margin_pct     NUMERIC,                    -- NULL when transparent='no': the source stores a lying 0
    total_cost_pct    NUMERIC,
    transparent       BOOLEAN NOT NULL,
    note              TEXT,
    raw_row_hash      TEXT NOT NULL,              -- sha256 of the full normalized source row
    tier_source       TEXT NOT NULL CHECK (tier_source IN ('cc1', 'cc2')),
    UNIQUE (raw_row_hash, tier_source)
);

CREATE INDEX idx_quotes_quarter_corridor ON quotes (quarter_id, corridor_id);
CREATE INDEX idx_quotes_corridor_amount  ON quotes (corridor_id, amount_usd);
CREATE INDEX idx_quotes_provider         ON quotes (provider_id);
