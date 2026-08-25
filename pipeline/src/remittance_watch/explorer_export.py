"""Emit the versioned explorer bundle (public/data/rpw-explorer-v1.json).

The corridor explorer's entire dataset, per ADR-0008: one committed, deterministic
JSON artifact the site fetches lazily. Its queries now also feed the public API
(ADR-0009) — which re-emits with readable field names rather than serving this
bundle as-is, so the two surfaces can never disagree about a number.
Nothing here is interpolated or invented: the only amounts are the two tiers the
World Bank actually surveys ($200 / $500), the only costs are the published columns,
and rankings are a faithful projection (ADR-0007) — negative costs stay verbatim so
the client can flag them, never clamp or drop them.

Shape (v1):
    meta       quarter, generated_utc, source, ranking policy (rendered verbatim in UI)
    countries  endpoints of indexed corridors — the pickers' option lists
    corridors  the searchable index: latest-quarter quote count + average, plus a
               4-quarter $200 trend (average + cheapest). A corridor with latest-
               quarter quotes but zero transparent ones IS indexed (avg null) — the
               explorer must be able to show "nothing fully disclosed here" rather
               than pretend the corridor doesn't exist. Corridors with no latest-
               quarter quotes at all are out of scope for current-cost search.
    quotes     every latest-quarter quote for indexed corridors, BOTH tiers, each a
               compact row referencing its corridor by index. Non-transparent rows
               carry margin null + transparent false — flagged, never ranked.

Output is deterministic given the same dataset (stable ORDER BY everywhere, rounded
Decimals) so quarterly regeneration diffs cleanly in review.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

from .site_export import SOURCE, _latest_quarter, _r

BUNDLE_VERSION = 1

TREND_QUARTERS = 4


def _corridor_index(conn, quarter_id: int) -> list[dict]:
    """Searchable corridors: anything with latest-quarter quotes. Average and
    quote count cover the transparent $200 tier (the SDG-benchmark basis the
    rest of the site uses); null average marks a nothing-disclosed corridor."""
    rows = conn.execute(
        """
        SELECT c.source_iso3, c.dest_iso3, cs.name, cd.name,
               COUNT(*) FILTER (WHERE qu.transparent AND qu.total_cost_pct IS NOT NULL
                                AND qu.amount_usd = 200) AS ranked_quotes,
               AVG(qu.total_cost_pct) FILTER (WHERE qu.transparent AND qu.total_cost_pct IS NOT NULL
                                              AND qu.amount_usd = 200)
        FROM quotes qu
        JOIN corridors c   ON c.id = qu.corridor_id
        JOIN countries cs  ON cs.iso3 = c.source_iso3
        JOIN countries cd  ON cd.iso3 = c.dest_iso3
        WHERE qu.quarter_id = %s
        GROUP BY 1, 2, 3, 4
        ORDER BY 1, 2
        """,
        (quarter_id,),
    ).fetchall()
    return [
        {
            "from": src,
            "to": dst,
            "from_name": src_name,
            "to_name": dst_name,
            "quotes": int(ranked),
            "avg_cost_pct": _r(avg),
        }
        for src, dst, src_name, dst_name, ranked, avg in rows
    ]


def _trends(conn, quarter_id: int) -> dict[tuple[str, str], list[dict]]:
    """Per corridor, the last TREND_QUARTERS quarters of transparent $200 data:
    average and cheapest published total cost. Corridors (or quarters) without
    data are simply absent — the chart renders the history that exists."""
    rows = conn.execute(
        """
        SELECT c.source_iso3, c.dest_iso3, q.id, q.label,
               AVG(qu.total_cost_pct), MIN(qu.total_cost_pct)
        FROM quotes qu
        JOIN corridors c  ON c.id = qu.corridor_id
        JOIN quarters q   ON q.id = qu.quarter_id
        WHERE q.id IN (SELECT id FROM quarters ORDER BY id DESC LIMIT %s)
          AND qu.amount_usd = 200 AND qu.transparent AND qu.total_cost_pct IS NOT NULL
        GROUP BY 1, 2, 3, 4
        ORDER BY 1, 2, 3
        """,
        (TREND_QUARTERS,),
    ).fetchall()
    trends: dict[tuple[str, str], list[dict]] = {}
    for src, dst, _qid, label, avg, cheapest in rows:
        trends.setdefault((src, dst), []).append(
            {"q": label, "avg": _r(avg), "cheapest": _r(cheapest)}
        )
    return trends


def _quote_rows(conn, quarter_id: int):
    """Every latest-quarter quote for indexed corridors, both published tiers,
    cheapest-first within corridor×tier (the ranking itself — computed once here,
    deterministically, so neither the client nor the API ever re-sorts).
    Non-transparent rows sort after transparent ones within the same tier.
    Shared by the explorer bundle (ADR-0008) and the public API (ADR-0009) so
    the two surfaces can never disagree about a number."""
    return conn.execute(
        """
        SELECT c.source_iso3, c.dest_iso3, qu.amount_usd, p.name, qu.instrument,
               qu.access_point,
               CASE WHEN qu.lcu_amount > 0 AND qu.fee_lcu IS NOT NULL
                    THEN qu.fee_lcu / qu.lcu_amount * 100 END AS fee_pct,
               qu.fx_margin_pct, qu.total_cost_pct, qu.transparent
        FROM quotes qu
        JOIN corridors c  ON c.id = qu.corridor_id
        JOIN providers p  ON p.id = qu.provider_id
        WHERE qu.quarter_id = %s
        ORDER BY c.source_iso3, c.dest_iso3, qu.amount_usd, qu.transparent DESC,
                 qu.total_cost_pct ASC NULLS LAST, p.name, qu.instrument,
                 qu.access_point NULLS LAST, qu.id
        -- qu.id: the survey publishes duplicate rows (same provider×instrument×
        -- access point, different fee/margin payloads) — without it the order
        -- inside those ties is whatever the planner returns
        """,
        (quarter_id,),
    ).fetchall()


# The ranking policy ships IN every artifact (bundle + API) — the methodology
# text travels with the numbers it describes (ADR-0007).
RANKING_POLICY = {
    "ranking": (
        "Providers are ranked by total cost exactly as published — ascending, "
        "never clamped or excluded (ADR-0007)."
    ),
    "negative_margin": (
        "A negative FX margin means the provider's exchange rate beats the World "
        "Bank's reference rate, so cost measured against the official rate falls "
        "below zero. The printed fee is still positive. Shown as a 'rate "
        "advantage' flag, never hidden."
    ),
    "non_transparent": (
        "Quotes whose FX margin is not disclosed are never ranked; they are listed "
        "separately with a flag (the published total is kept)."
    ),
}


def _quotes(conn, quarter_id: int, corridor_pos: dict[tuple[str, str], int]) -> list[dict]:
    rows = _quote_rows(conn, quarter_id)
    quotes = []
    for src, dst, amount, provider, instrument, access, fee, margin, total, transparent in rows:
        pos = corridor_pos.get((src, dst))
        if pos is None:
            continue  # corridor had no latest-quarter rows in the index query — impossible today
        quotes.append(
            {
                "c": pos,
                "t": int(amount),
                "p": provider,
                "i": instrument,
                "a": access,
                "f": _r(fee),
                "m": _r(margin),
                "tc": _r(total),
                "x": bool(transparent),
            }
        )
    return quotes


def build_explorer_data(conn) -> dict:
    quarter_id, quarter_label = _latest_quarter(conn)
    corridors = _corridor_index(conn, quarter_id)
    if not corridors:
        raise SystemExit("no latest-quarter quotes — run `rw-ingest ingest` first")
    corridor_pos = {(c["from"], c["to"]): i for i, c in enumerate(corridors)}
    trends = _trends(conn, quarter_id)
    for corridor in corridors:
        corridor["trend"] = trends.get((corridor["from"], corridor["to"]), [])

    countries = sorted(
        {(c["from"], c["from_name"]) for c in corridors}
        | {(c["to"], c["to_name"]) for c in corridors}
    )

    return {
        "meta": {
            "version": BUNDLE_VERSION,
            "quarter": quarter_label,
            "generated_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "generator": "rw-ingest export-explorer",
            "source": SOURCE,
            "amounts": [200, 500],
            "policy": RANKING_POLICY,
        },
        "countries": [{"iso3": iso, "name": name} for iso, name in countries],
        "corridors": corridors,
        "quotes": _quotes(conn, quarter_id, corridor_pos),
    }


def export_explorer_data(conn, out: Path) -> Path:
    payload = build_explorer_data(conn)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write("\n")
    return out
