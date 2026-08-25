"""The committed public/v1/ tree is itself a contract (ADR-0009): the index,
the corridor records, and the per-tier slices must agree with one another, and
the OpenAPI spec must describe what is actually on disk. These checks need no
Postgres — they catch a hand-edited or partially regenerated tree, which the
fixture-based shape tests cannot see. The tree ships in the repo, so a missing
directory fails loudly rather than skipping."""

import json
from pathlib import Path

PUBLIC_V1 = Path(__file__).resolve().parents[2] / "public" / "v1"


def _loads(path: Path):
    text = path.read_text(encoding="utf-8")
    assert text.endswith("\n"), f"{path.relative_to(PUBLIC_V1)}: missing trailing newline"
    assert "NaN" not in text and "Infinity" not in text, f"{path}: non-finite literal"
    return json.loads(text)


def _rankable(q) -> bool:
    return q["transparent"] and q["total_cost_pct"] is not None


def test_tree_exists():
    assert PUBLIC_V1.is_dir(), f"committed API tree missing: {PUBLIC_V1}"


def test_index_matches_corridor_files():
    idx = _loads(PUBLIC_V1 / "corridors.json")
    listed = {(c["from"], c["to"]) for c in idx["corridors"]}
    on_disk = {
        (p.parent.name, p.stem)
        for p in (PUBLIC_V1 / "corridors").glob("*/*.json")
    }
    assert listed == on_disk, "corridors.json and corridors/{from}/{to}.json disagree"
    assert len(idx["corridors"]) == len(listed), "duplicate corridor entries"


def test_tier_slices_match_corridor_records():
    """Every slice's rows are exactly its corridor record's rows at that tier,
    ranked cheapest-first, and a tier with no rows has no file."""
    checked = 0
    for rec_path in sorted((PUBLIC_V1 / "corridors").glob("*/*.json")):
        rec = _loads(rec_path)
        src, dst = Path(rec_path).parent.name, rec_path.stem
        by_amount = {amt: [] for amt in rec["meta"]["amounts"]}
        for q in rec["quotes"]:
            by_amount[q["amount_usd"]].append(q)

        for amount, expected in by_amount.items():
            slice_path = PUBLIC_V1 / "quote" / src / dst / f"{amount}.json"
            if not expected:
                assert not slice_path.exists(), f"unexpected empty-tier file: {slice_path}"
                continue
            sl = _loads(slice_path)
            want_ranked = [q for q in expected if _rankable(q)]
            assert len(sl["ranked"]) == len(want_ranked), str(slice_path)
            assert len(sl["not_ranked"]) == len(expected) - len(want_ranked), str(slice_path)
            assert {json.dumps(q, sort_keys=True) for q in sl["ranked"] + sl["not_ranked"]} == {
                json.dumps(q, sort_keys=True) for q in expected
            }, f"{slice_path}: rows disagree with the corridor record"
            assert [q["total_cost_pct"] for q in sl["ranked"]] == [
                q["total_cost_pct"] for q in want_ranked
            ], f"{slice_path}: ranked order lost"
            checked += 1
    assert checked > 0, "no tier slices found — tree looks empty"


def test_one_generation_snapshot():
    """Every payload carries the same generated_utc — one quarterly snapshot.
    Mixed stamps mean a partial regeneration slipped through."""
    stamps = {}
    for p in PUBLIC_V1.rglob("*.json"):
        doc = _loads(p)
        if isinstance(doc, dict) and "meta" in doc:
            stamps[p.relative_to(PUBLIC_V1).as_posix()] = doc["meta"]["generated_utc"]
    assert stamps, "no stamped payloads found"
    assert set(stamps.values()) == {next(iter(stamps.values()))}, (
        "mixed generated_utc across payloads — partial regeneration?"
    )


def test_openapi_paths_resolve_to_the_tree():
    spec = _loads(PUBLIC_V1 / "openapi.json")
    base = spec["servers"][0]["url"].rstrip("/")
    # the basePath lives in the server URL ONLY — OAS appends path keys verbatim
    assert base.endswith("/remittance-watch"), "server URL should carry the Pages basePath"
    assert set(spec["paths"]) == {
        "/v1/corridors.json",
        "/v1/corridors/{from}/{to}.json",
        "/v1/quote/{from}/{to}/{amount}.json",
    }
    # composed server + path must name files this repo actually serves
    assert (PUBLIC_V1 / "corridors.json").exists()
    assert (PUBLIC_V1 / "corridors").is_dir()
    assert (PUBLIC_V1 / "quote").is_dir()
