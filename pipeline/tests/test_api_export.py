"""The public API v1 (ADR-0009): readable stable field names, ADR-0007 ranking
order shared with the explorer bundle, honest 404s, byte-deterministic files,
and an OpenAPI spec that describes exactly what gets emitted. E2E against the
contract fixture; skips without Postgres."""

import json

import pytest

from remittance_watch.api_export import PAGES_BASE, build_corridor_record, export_api
from remittance_watch.loader import ingest_rows
from remittance_watch.parser import parse_workbook

pytestmark = pytest.mark.usefixtures("clean_db")

GENERATED = "2026-08-25T00:00:00Z"  # injected → byte-determinism is testable


@pytest.fixture()
def api_dir(migrated_conn, fixture_path, tmp_path):
    ingest_rows(migrated_conn, parse_workbook(fixture_path))
    export_api(migrated_conn, tmp_path, generated=GENERATED)
    return tmp_path


def _load(api_dir, rel):
    return json.loads((api_dir / rel).read_text())


class TestApiIndex:
    def test_meta_and_index(self, api_dir):
        idx = _load(api_dir, "corridors.json")
        meta = idx["meta"]
        assert meta["api_version"] == 1
        assert meta["quarter"] == "2025_3Q"
        assert meta["generated_utc"] == GENERATED
        assert meta["amounts"] == [200, 500]
        assert set(meta["policy"]) == {"ranking", "negative_margin", "non_transparent"}
        assert meta["source"]["license"] == "CC BY 4.0"

        assert [(c["from"], c["to"]) for c in idx["corridors"]] == [
            ("AGO", "NAM"), ("AGO", "ZAF"),
        ]
        agonam = idx["corridors"][0]
        assert agonam["from_name"] == "Angola"
        assert agonam["ranked_quotes_200"] == 2
        assert agonam["avg_cost_pct_200"] == 7.72  # hand-computed: (9.94 + 5.50) / 2
        agozaf = idx["corridors"][1]
        assert agozaf["ranked_quotes_200"] == 0
        assert agozaf["avg_cost_pct_200"] is None  # nothing disclosed — still listed


class TestCorridorRecord:
    def test_ranking_order_readable_fields(self, api_dir):
        rec = _load(api_dir, "corridors/AGO/NAM.json")
        assert rec["corridor"] == {
            "from": "AGO", "to": "NAM", "from_name": "Angola", "to_name": "Namibia",
        }
        assert rec["avg_cost_pct_200"] == 7.72
        assert rec["trend"] == [
            {"quarter": "2025_3Q", "avg_cost_pct": 7.72, "cheapest_cost_pct": 5.5},
        ]
        # cheapest-first within tier, $200 before $500 — the ADR-0007 order
        assert [(q["amount_usd"], q["total_cost_pct"]) for q in rec["quotes"]] == [
            (200, 5.5), (200, 9.94), (500, 5.41), (500, 9.95),
        ]
        top = rec["quotes"][0]
        assert top["provider"] == "Example Mobile SA"
        # decomposition: 990/33000*100 = 3.0 fee + 2.5 margin = 5.5 total
        assert top["fee_pct"] == 3.0
        assert top["fx_margin_pct"] == 2.5
        assert top["cost_usd"] == 11.0  # 5.5% of $200 — derived, so nobody else has to
        assert top["access_point"] is None or isinstance(top["access_point"], str)
        assert top["transparent"] is True

    def test_nothing_disclosed_corridor_keeps_flagged_quotes(self, api_dir):
        """AGO>ZAF: the bank hides its margin — quotes stay visible with their
        published totals, transparent=false, and the corridor is still served."""
        rec = _load(api_dir, "corridors/AGO/ZAF.json")
        assert rec["ranked_quotes_200"] == 0
        assert rec["avg_cost_pct_200"] is None
        assert len(rec["quotes"]) == 2
        assert all(q["transparent"] is False for q in rec["quotes"])
        assert all(q["fx_margin_pct"] is None for q in rec["quotes"])
        assert [q["total_cost_pct"] for q in rec["quotes"]] == [4.24, 2.55]  # kept verbatim


class TestQuoteRecord:
    def test_ranked_vs_not_ranked(self, api_dir):
        q = _load(api_dir, "quote/AGO/NAM/200.json")
        assert q["amount_usd"] == 200
        assert [r["total_cost_pct"] for r in q["ranked"]] == [5.5, 9.94]
        assert q["not_ranked"] == []

        zaf = _load(api_dir, "quote/AGO/ZAF/200.json")
        assert zaf["ranked"] == []  # nothing rankable: margin undisclosed
        assert [r["total_cost_pct"] for r in zaf["not_ranked"]] == [4.24]

    def test_unknown_corridor_and_tier_are_none(self, migrated_conn, fixture_path):
        from remittance_watch.api_export import build_quote_record

        ingest_rows(migrated_conn, parse_workbook(fixture_path))
        # the API's 404 is a missing file — the builders return None for both
        assert build_corridor_record(migrated_conn, "USA", "IND", GENERATED) is None
        assert build_corridor_record(migrated_conn, "ago", "nam", GENERATED) is not None  # case-insensitive
        assert build_corridor_record(migrated_conn, "AGO", "NPL", GENERATED) is None
        assert build_quote_record(migrated_conn, "AGO", "NAM", 300, GENERATED) is None
        assert build_quote_record(migrated_conn, "USA", "IND", 200, GENERATED) is None


class TestFiles:
    def test_emitted_file_set(self, api_dir):
        rels = sorted(str(p.relative_to(api_dir)) for p in api_dir.rglob("*.json"))
        assert rels == [
            "corridors.json",
            "corridors/AGO/NAM.json",
            "corridors/AGO/ZAF.json",
            "openapi.json",
            "quote/AGO/NAM/200.json",
            "quote/AGO/NAM/500.json",
            "quote/AGO/ZAF/200.json",
            "quote/AGO/ZAF/500.json",
        ]

    def test_byte_deterministic(self, migrated_conn, fixture_path, tmp_path):
        """Same data + same stamp → byte-identical files, so the quarterly
        artifact diff shows only real data changes (ADR-0005's thesis)."""
        ingest_rows(migrated_conn, parse_workbook(fixture_path))
        a, b = tmp_path / "a", tmp_path / "b"
        export_api(migrated_conn, a, generated=GENERATED)
        export_api(migrated_conn, b, generated=GENERATED)
        for pa in sorted(a.rglob("*.json")):
            pb = b / pa.relative_to(a)
            assert pa.read_bytes() == pb.read_bytes(), pa.name

    def test_openapi_describes_emissions(self, api_dir):
        spec = _load(api_dir, "openapi.json")
        assert spec["openapi"] == "3.1.0"
        assert spec["servers"][0]["url"] == PAGES_BASE
        # OAS appends path keys to the server URL verbatim (no RFC-3986
        # resolution): the server carries the /remittance-watch basePath, so a
        # path key repeating it would compose a doubled segment that 404s for
        # every spec-driven client (Swagger UI try-it-out, code generators).
        assert set(spec["paths"]) == {
            "/v1/corridors.json",
            "/v1/corridors/{from}/{to}.json",
            "/v1/quote/{from}/{to}/{amount}.json",
        }
        for key in spec["paths"]:
            assert key.startswith("/v1/")
            assert f"{PAGES_BASE}{key}" == (
                f"https://viji-saravanan.github.io/remittance-watch{key}"
            )
        quote_op = spec["paths"]["/v1/quote/{from}/{to}/{amount}.json"]["get"]
        assert quote_op["parameters"][2]["schema"]["enum"] == [200, 500]
        # the payload key is `not_ranked` everywhere the prose speaks of it
        assert "flagged" not in json.dumps(spec)
