"""Public API v1 (ADR-0009): static, path-mapped JSON under public/v1/,
emitted at ingest time and committed like every other artifact.

    /v1/corridors.json                     index of every surveyed corridor
    /v1/corridors/{from}/{to}.json         one corridor, both tiers, ranked
    /v1/quote/{from}/{to}/{amount}.json    one corridor at one published tier
    /v1/openapi.json                       the spec describing all of the above

The audience is researchers and journalists, so field names are readable and
stable (`fx_margin_pct`, never `m`) — renames are breaking changes under the
ADR-0009 version policy. Every payload carries `meta` (quarter, generated_utc,
source, license) so a single saved file stays citable without the site.

Numbers come from the SAME queries as the explorer bundle (ADR-0008) — the
corridor index, the trend, and the ranking ORDER BY are shared code, so the
site and the API can never disagree about a published cost.
"""

import json
from datetime import UTC, datetime
from pathlib import Path

from .explorer_export import RANKING_POLICY, _corridor_index, _quote_rows, _trends
from .site_export import SOURCE, _latest_quarter, _r

API_VERSION = 1

# Production origin for the OpenAPI `servers` field. Mirrors next.config's
# basePath (owner/repo); changes only on a repo rename or custom domain.
PAGES_BASE = "https://viji-saravanan.github.io/remittance-watch"

AMOUNTS = [200, 500]


def _api_quote(amount: int, provider: str, instrument: str, access: str | None,
               fee: float | None, margin: float | None, total: float | None,
               transparent: bool) -> dict:
    """A quote row with readable, stable field names (ADR-0009 rule 1)."""
    return {
        "provider": provider,
        "instrument": instrument,
        "access_point": access,
        "amount_usd": int(amount),
        "fee_pct": _r(fee),
        "fx_margin_pct": _r(margin),
        "total_cost_pct": _r(total),
        "cost_usd": None if total is None else _r(total * amount / 100),
        "transparent": bool(transparent),
    }


def _meta(quarter: str, generated: str) -> dict:
    return {
        "api_version": API_VERSION,
        "quarter": quarter,
        "generated_utc": generated,
        "generator": "rw-ingest export-api",
        "source": SOURCE,
        "amounts": AMOUNTS,
        "policy": RANKING_POLICY,
    }


def _index_payload(index_rows, quarter: str, generated: str) -> dict:
    """GET /v1/corridors.json — the discovery surface. Same corridor index as
    the explorer (searchable = has latest-quarter quotes; nothing-disclosed
    corridors stay listed). The average is named avg_cost_pct_200: the $200 /
    SDG 10.c basis, spelled out because the API has no prose to explain it."""
    return {
        "meta": _meta(quarter, generated),
        "corridors": [
            {
                "from": r["from"],
                "to": r["to"],
                "from_name": r["from_name"],
                "to_name": r["to_name"],
                "ranked_quotes_200": int(r["quotes"]),
                "avg_cost_pct_200": _r(r["avg_cost_pct"]),
            }
            for r in index_rows
        ],
    }


def build_api_index(conn, generated: str) -> dict:
    quarter_id, quarter = _latest_quarter(conn)
    return _index_payload(_corridor_index(conn, quarter_id), quarter, generated)


def _corridor_payload(src: str, dst: str, index_rows, trends, quote_rows) -> dict | None:
    """Assemble one corridor's payload from the already-fetched index rows,
    trends, and quote rows. None → the corridor isn't surveyed this quarter
    and the API's 404 is honest (ADR-0009 rule 5)."""
    src, dst = src.upper(), dst.upper()
    row = next((r for r in index_rows if (r["from"], r["to"]) == (src, dst)), None)
    if row is None:
        return None
    corridor = {"from": src, "to": dst, "from_name": row["from_name"], "to_name": row["to_name"]}
    trend = [
        {"quarter": t["q"], "avg_cost_pct": _r(t["avg"]), "cheapest_cost_pct": _r(t["cheapest"])}
        for t in trends.get((src, dst), [])
    ]
    quotes = [
        _api_quote(amount, provider, instrument, access, fee, margin, total, transparent)
        for r_src, r_dst, amount, provider, instrument, access, fee, margin, total, transparent
        in quote_rows
        if (r_src, r_dst) == (src, dst)
    ]
    return {
        "corridor": corridor,
        "ranked_quotes_200": int(row["quotes"]),
        "avg_cost_pct_200": _r(row["avg_cost_pct"]),
        "trend": trend,
        "quotes": quotes,
    }


def build_corridor_record(conn, src: str, dst: str, generated: str) -> dict | None:
    """GET /v1/corridors/{from}/{to}.json — every quote, both tiers, in ranking
    order (cheapest-first within tier, non-transparent after transparent)."""
    quarter_id, quarter = _latest_quarter(conn)
    payload = _corridor_payload(
        src, dst, _corridor_index(conn, quarter_id), _trends(conn, quarter_id),
        _quote_rows(conn, quarter_id),
    )
    if payload is None:
        return None
    payload = {"meta": _meta(quarter, generated), **payload}
    return payload


def build_quote_record(conn, src: str, dst: str, amount: int, generated: str) -> dict | None:
    """GET /v1/quote/{from}/{to}/{amount}.json — the issue's query endpoint,
    path-mapped. `ranked` is the ADR-0007 answer (transparent with a published
    total, cheapest-first); `not_ranked` is shown, never ranked."""
    quarter_id, quarter = _latest_quarter(conn)
    full = _corridor_payload(
        src, dst, _corridor_index(conn, quarter_id), _trends(conn, quarter_id),
        _quote_rows(conn, quarter_id),
    )
    if full is None or int(amount) not in AMOUNTS:
        return None  # unknown corridor or unpublished tier — the 404 is the answer
    ranked = [q for q in full["quotes"] if q["transparent"] and q["total_cost_pct"] is not None]
    not_ranked = [q for q in full["quotes"] if not (q["transparent"] and q["total_cost_pct"] is not None)]
    return {
        "meta": _meta(quarter, generated),
        "corridor": full["corridor"],
        "amount_usd": int(amount),
        "ranked": [q for q in ranked if q["amount_usd"] == int(amount)],
        "not_ranked": [q for q in not_ranked if q["amount_usd"] == int(amount)],
    }


def _openapi() -> dict:
    quote_schema = {
        "type": "object",
        "properties": {
            "provider": {"type": "string"},
            "instrument": {"type": "string"},
            "access_point": {"type": ["string", "null"]},
            "amount_usd": {"type": "integer", "enum": AMOUNTS},
            "fee_pct": {"type": ["number", "null"], "description": "printed fee, % of transfer"},
            "fx_margin_pct": {"type": ["number", "null"],
                              "description": "exchange-rate margin vs the World Bank reference "
                                             "rate, % of transfer; null = not disclosed"},
            "total_cost_pct": {"type": ["number", "null"],
                               "description": "published total cost, % of transfer; may be "
                                              "negative (rate advantage, ADR-0007)"},
            "cost_usd": {"type": ["number", "null"],
                         "description": "total_cost_pct applied to amount_usd"},
            "transparent": {"type": "boolean",
                            "description": "true = FX margin disclosed; false rows are never "
                                           "ranked"},
        },
        "required": ["provider", "instrument", "access_point", "amount_usd", "fee_pct",
                     "fx_margin_pct", "total_cost_pct", "cost_usd", "transparent"],
    }
    meta_schema = {
        "type": "object",
        "properties": {
            "api_version": {"type": "integer"},
            "quarter": {"type": "string", "example": "2025_3Q"},
            "generated_utc": {"type": "string", "format": "date-time"},
            "generator": {"type": "string"},
            "source": {"type": "object"},
            "amounts": {"type": "array", "items": {"type": "integer"}},
            "policy": {"type": "object",
                       "description": "the ranking methodology, shipped with every payload"},
        },
        "required": ["api_version", "quarter", "generated_utc", "source", "policy"],
    }
    corridor_ref = {
        "type": "object",
        "properties": {
            "from": {"type": "string", "description": "ISO-3166 alpha-3"},
            "to": {"type": "string", "description": "ISO-3166 alpha-3"},
            "from_name": {"type": "string"},
            "to_name": {"type": "string"},
        },
        "required": ["from", "to", "from_name", "to_name"],
    }
    not_found = {"description": "Corridor or tier not published this quarter (ADR-0009 rule 5)"}
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "RemitWatch API",
            "version": f"v{API_VERSION}",
            "summary": "The true cost of sending money home, whoever prices it.",
            "description": (
                "Every provider the World Bank's Remittance Prices Worldwide survey prices on a "
                "corridor, ranked by true total cost — printed fee plus exchange-rate margin — "
                "exactly as published (negative totals included; ADR-0007). Static JSON served "
                "from a CDN; regenerated each quarterly ingest; every number diffable in git.\n\n"
                "Version policy (ADR-0009): additive changes ship in place; breaking changes "
                "ship as a new path version with at least one quarter of dual-running and a "
                "README deprecation banner."
            ),
            "license": {"name": "CC BY 4.0 (data)",
                        "url": "https://creativecommons.org/licenses/by/4.0/"},
        },
        "servers": [{"url": PAGES_BASE, "description": "GitHub Pages (production)"}],
        "paths": {
            "/remittance-watch/v1/corridors.json": {
                "get": {
                    "operationId": "listCorridors",
                    "summary": "Index of every surveyed corridor",
                    "responses": {"200": {
                        "description": "Corridor index for the latest quarter",
                        "content": {"application/json": {"schema": {
                            "type": "object",
                            "properties": {
                                "meta": meta_schema,
                                "corridors": {"type": "array", "items": {
                                    "allOf": [corridor_ref,
                                              {"type": "object", "properties": {
                                                  "ranked_quotes_200": {"type": "integer"},
                                                  "avg_cost_pct_200": {
                                                      "type": ["number", "null"]}}}]},
                                },
                            },
                            "required": ["meta", "corridors"],
                        }}}},
                    },
                },
            },
            "/remittance-watch/v1/corridors/{from}/{to}.json": {
                "get": {
                    "operationId": "getCorridor",
                    "summary": "One corridor: every quote, both tiers, ranking order",
                    "parameters": [
                        {"name": "from", "in": "path", "required": True,
                         "schema": {"type": "string", "example": "USA"},
                         "description": "origin country, ISO-3166 alpha-3"},
                        {"name": "to", "in": "path", "required": True,
                         "schema": {"type": "string", "example": "IND"},
                         "description": "destination country, ISO-3166 alpha-3"},
                    ],
                    "responses": {
                        "200": {"description": "The corridor's quotes in ADR-0007 ranking order",
                                "content": {"application/json": {"schema": {
                                    "type": "object",
                                    "properties": {
                                        "meta": meta_schema,
                                        "corridor": corridor_ref,
                                        "ranked_quotes_200": {"type": "integer"},
                                        "avg_cost_pct_200": {"type": ["number", "null"]},
                                        "trend": {"type": "array", "items": {
                                            "type": "object",
                                            "properties": {
                                                "quarter": {"type": "string"},
                                                "avg_cost_pct": {"type": ["number", "null"]},
                                                "cheapest_cost_pct": {"type": ["number", "null"]},
                                            },
                                        }},
                                        "quotes": {"type": "array", "items": quote_schema},
                                    },
                                    "required": ["meta", "corridor", "quotes"],
                                }}}},
                        "404": not_found,
                    },
                },
            },
            "/remittance-watch/v1/quote/{from}/{to}/{amount}.json": {
                "get": {
                    "operationId": "getQuotes",
                    "summary": "One corridor at one published tier, ranked vs flagged",
                    "description": "Path-mapped form of the issue's "
                                   "GET /v1/quote?from=&to=&amount= (static CDN, ADR-0009).",
                    "parameters": [
                        {"name": "from", "in": "path", "required": True,
                         "schema": {"type": "string", "example": "USA"}},
                        {"name": "to", "in": "path", "required": True,
                         "schema": {"type": "string", "example": "IND"}},
                        {"name": "amount", "in": "path", "required": True,
                         "schema": {"type": "integer", "enum": AMOUNTS},
                         "description": "the only amounts the World Bank publishes"},
                    ],
                    "responses": {
                        "200": {"description": "Ranked (and flagged) quotes for the tier",
                                "content": {"application/json": {"schema": {
                                    "type": "object",
                                    "properties": {
                                        "meta": meta_schema,
                                        "corridor": corridor_ref,
                                        "amount_usd": {"type": "integer"},
                                        "ranked": {"type": "array", "items": quote_schema},
                                        "not_ranked": {"type": "array", "items": quote_schema},
                                    },
                                    "required": ["meta", "corridor", "amount_usd", "ranked",
                                                 "not_ranked"],
                                }}}},
                        "404": not_found,
                    },
                },
            },
        },
    }


def export_api(conn, out: Path, generated: str | None = None) -> list[Path]:
    """Write every v1 artifact. The three source queries run ONCE and every
    file is sliced from memory; one timestamp stamps the whole run so a
    quarterly regeneration is one coherent snapshot. `generated` is injectable
    for byte-determinism tests."""
    generated = generated or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    quarter_id, quarter = _latest_quarter(conn)
    index_rows = _corridor_index(conn, quarter_id)
    trends = _trends(conn, quarter_id)
    quote_rows = _quote_rows(conn, quarter_id)
    written: list[Path] = []

    def _write(rel: Path, payload: dict) -> None:
        path = out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
            fh.write("\n")
        written.append(path)

    index = _index_payload(index_rows, quarter, generated)
    _write(Path("corridors.json"), index)

    for c in index["corridors"]:
        payload = _corridor_payload(c["from"], c["to"], index_rows, trends, quote_rows)
        assert payload is not None  # index rows always resolve — same query
        _write(Path("corridors") / c["from"] / f"{c['to']}.json",
               {"meta": _meta(quarter, generated), **payload})
        for amount in AMOUNTS:
            ranked = [q for q in payload["quotes"]
                      if q["amount_usd"] == amount and q["transparent"]
                      and q["total_cost_pct"] is not None]
            not_ranked = [q for q in payload["quotes"]
                          if q["amount_usd"] == amount
                          and not (q["transparent"] and q["total_cost_pct"] is not None)]
            if not ranked and not not_ranked:
                continue  # no quotes at this tier — the file's absence IS the 404
            _write(Path("quote") / c["from"] / c["to"] / f"{amount}.json", {
                "meta": _meta(quarter, generated),
                "corridor": payload["corridor"],
                "amount_usd": amount,
                "ranked": ranked,
                "not_ranked": not_ranked,
            })
    _write(Path("openapi.json"), _openapi())
    return sorted(written)
