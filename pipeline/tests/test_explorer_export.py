"""The explorer bundle (ADR-0008): schema, deterministic output, the ranking
projection (cheapest-first, verbatim costs — ADR-0007), and the nothing-disclosed
corridor case. E2E against the contract fixture; skips without Postgres."""

import json

import pytest

from remittance_watch.explorer_export import build_explorer_data
from remittance_watch.loader import ingest_rows
from remittance_watch.parser import parse_workbook

pytestmark = pytest.mark.usefixtures("clean_db")


@pytest.fixture()
def bundle(migrated_conn, fixture_path):
    ingest_rows(migrated_conn, parse_workbook(fixture_path))
    return build_explorer_data(migrated_conn)


def _find(bundle: dict, dst: str) -> dict:
    return next(c for c in bundle["corridors"] if c["to"] == dst)


class TestExplorerBundle:
    def test_meta_and_schema(self, bundle):
        meta = bundle["meta"]
        assert meta["version"] == 1
        assert meta["quarter"] == "2025_3Q"  # quarter id IS the period, so MAX(id) is latest
        assert meta["amounts"] == [200, 500]
        assert set(meta["policy"]) == {"ranking", "negative_margin", "non_transparent"}
        assert set(bundle) == {"meta", "countries", "corridors", "quotes"}

    def test_corridor_index(self, bundle):
        """IND>NPL has only 2025_1Q data — not indexed. AGO>ZAF IS indexed with
        zero transparent quotes: it must stay searchable so the explorer can show
        its nothing-disclosed state instead of pretending it doesn't exist."""
        codes = [(c["from"], c["to"]) for c in bundle["corridors"]]
        assert codes == [("AGO", "NAM"), ("AGO", "ZAF")]
        assert [c["iso3"] for c in bundle["countries"]] == ["AGO", "NAM", "ZAF"]

    def test_hand_computed_ranking(self, bundle):
        """The milestone acceptance pattern on the fixture: averages equal
        hand-computed values within rounding."""
        agonam = _find(bundle, "NAM")
        # Example MTO Ltd 9.94% and Example Mobile SA 5.50% at $200 → avg 7.72
        assert agonam["quotes"] == 2
        assert agonam["avg_cost_pct"] == 7.72
        assert agonam["trend"] == [{"q": "2025_3Q", "avg": 7.72, "cheapest": 5.5}]

        agozaf = _find(bundle, "ZAF")
        assert agozaf["quotes"] == 0
        assert agozaf["avg_cost_pct"] is None
        assert agozaf["trend"] == []

    def test_quotes_ranking_projection(self, bundle):
        corridors = bundle["corridors"]
        nam_pos = corridors.index(_find(bundle, "NAM"))
        zaf_pos = corridors.index(_find(bundle, "ZAF"))

        rows = [q for q in bundle["quotes"] if q["c"] == nam_pos]
        assert len(rows) == 4  # 2 providers × both tiers
        tier200 = [q for q in rows if q["t"] == 200]
        # cheapest-first, verbatim — the ADR-0007 ranking, computed once here
        assert [q["tc"] for q in tier200] == [5.5, 9.94]
        assert tier200[0]["p"] == "Example Mobile SA"
        # decomposition: 990/33000*100 = 3.0 fee + 2.5 margin = 5.5 total
        assert tier200[0]["f"] == 3.0
        assert tier200[0]["m"] == 2.5

        flagged = [q for q in bundle["quotes"] if q["c"] == zaf_pos]
        assert len(flagged) == 2  # both tiers of the non-transparent bank
        assert all(q["m"] is None and q["x"] is False for q in flagged)
        assert all(q["tc"] is not None for q in flagged)  # published total kept

    def test_negative_costs_exported_verbatim(self, migrated_conn, bundle):
        """ADR-0007: a negative-total quote keeps its published number and sorts
        first — the client flags it, the exporter never normalizes it."""
        migrated_conn.execute(
            """
            INSERT INTO quotes (quarter_id, corridor_id, provider_id, firm_type, instrument,
                                access_point, amount_usd, currency_code, lcu_amount, fee_lcu,
                                fx_rate, interbank_fx_rate, fx_margin_pct, total_cost_pct,
                                transparent, raw_row_hash, tier_source)
            SELECT (SELECT id FROM quarters ORDER BY id DESC LIMIT 1),
                   (SELECT id FROM corridors WHERE code = 'AGONAM'),
                   (SELECT id FROM providers WHERE name = 'Example MTO Ltd'),
                   'MTO', 'Cash', 'Bank', 200, 'AOA', 33000, 500.0, 165, 160,
                   -3.26, -1.74, true, 'test-negative-1', 'cc1'
            """
        )
        migrated_conn.commit()
        fresh = build_explorer_data(migrated_conn)
        pos = next(
            i for i, c in enumerate(fresh["corridors"]) if c["from"] == "AGO" and c["to"] == "NAM"
        )
        tier200 = [q for q in fresh["quotes"] if q["c"] == pos and q["t"] == 200]
        assert tier200[0]["tc"] == -1.74  # verbatim, ranked first
        assert tier200[0]["m"] == -3.26
        assert tier200[0]["x"] is True

    def test_deterministic_output(self, migrated_conn, fixture_path):
        ingest_rows(migrated_conn, parse_workbook(fixture_path))
        a = build_explorer_data(migrated_conn)
        b = build_explorer_data(migrated_conn)
        a["meta"].pop("generated_utc")
        b["meta"].pop("generated_utc")
        assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
