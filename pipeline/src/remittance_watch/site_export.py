"""Emit the versioned JSON the website renders (app/data/site-data.json).

Every figure on the landing page flows from here; the components import the
JSON at build time and carry no data literals. Two kinds of content:

* computed — queried live from the loaded dataset. The pipeline is the source
  of truth for anything we can derive ourselves, so the site shows OUR numbers
  (labeled as such) next to the World Bank's.
* cited — published third-party constants (RPW report, UN SDG target, KNOMAD
  flows). These live here — and only here — each with its source URL, so the
  provenance is auditable in one place instead of scattered across components.

Output is deterministic given the same dataset: stable ordering, rounded
Decimals. Regenerating after a re-ingest only changes what the data changed.

Country centroids are reference geography (Natural Earth admin-0 centroids,
public domain, rounded to one decimal) used solely to place corridor arcs on
the hero map — they carry no pricing claim, and a country missing from the
table simply renders without an arc rather than with a guessed position.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

# ── cited constants (published third-party figures, with provenance) ──────

CITED = {
    "global_avg_cost_pct": 6.36,
    "global_avg_label": "Global average cost of sending $200 — RPW Issue 54, Q3 2025",
    "global_avg_url": (
        "https://remittanceprices.worldbank.org/sites/default/files/2026-04/"
        "RPW_main_report_and_annex_Q325.pdf"
    ),
    "sdg_target_pct": 3.0,
    "sdg_label": "UN SDG target 10.c — less than 3% by 2030",
    "sdg_url": "https://sdgs.un.org/goals/goal10",
    "digital_avg_pct": 4.59,
    "cash_avg_pct": 7.30,
    "avg_split_label": "Digital vs cash average cost of sending $200 — RPW Issue 54, Q3 2025",
    "avg_split_url": (
        "https://remittanceprices.worldbank.org/sites/default/files/2026-04/"
        "RPW_main_report_and_annex_Q325.pdf"
    ),
    "flows_usd_bn": 685,
    "flows_year": 2024,
    "flows_label": "Sent to low- and middle-income countries in 2024 — World Bank / KNOMAD",
    "flows_url": "https://www.knomad.org/publication/migration-and-development-brief-40",
}

SOURCE = {
    "workbook": "World Bank Remittance Prices Worldwide, Issue 54 (Q3 2025)",
    "license": "CC BY 4.0",
    "url": "https://remittanceprices.worldbank.org",
}

# Milestone state is project fact, not dataset — kept beside the data it
# describes so the site still has exactly one file to import.
REPO = "https://github.com/viji-saravanan/remittance-watch"
ROADMAP = [
    {"id": "M0", "desc": "Skeleton, design system, CI, deploy", "state": "shipped", "href": f"{REPO}/issues/2"},
    {"id": "M1", "desc": "World Bank workbook → tested Postgres dataset", "state": "shipped", "href": f"{REPO}/issues/3"},
    {"id": "M2", "desc": "Corridor search & true-cost ranking UI", "state": "in progress", "href": f"{REPO}/issues/4"},
    {"id": "M3", "desc": "Public API for researchers & journalists", "state": "queued", "href": f"{REPO}/issues/5"},
    {"id": "M4", "desc": "Live FX overlay, price-drop alerts, Hindi", "state": "queued", "href": f"{REPO}/issues/6"},
    {"id": "M5", "desc": "Methodology, accessibility, launch", "state": "queued", "href": f"{REPO}/issues/7"},
]

# RPW's access points split into digital vs cash channels the way the report's
# methodology does; the classification is documented here rather than implied.
DIGITAL_ACCESS_POINTS = ("Internet", "Mobile phone")

TOP_CORRIDOR_COUNT = 14

COST_BANDS = (3, 6, 9, 12, 15)  # upper bounds in %; last band is "15%+"

COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "AGO": (17.5, -12.3), "ALB": (20.1, 41.1), "ARE": (54.3, 23.9), "ARG": (-65.2, -35.4),
    "ARM": (45.0, 40.3), "ATA": (0.0, 0.0), "AUS": (134.5, -25.7), "AUT": (14.1, 47.6),
    "AZE": (47.6, 40.4), "BDI": (29.9, -3.4), "BEL": (4.5, 50.6), "BEN": (2.3, 9.6),
    "BFA": (-1.7, 12.3), "BGD": (90.3, 23.8), "BGR": (25.2, 42.8), "BIH": (17.8, 44.2),
    "BLZ": (-88.6, 17.2), "BOL": (-64.7, -16.7), "BRA": (-53.1, -10.8), "BRN": (114.7, 4.5),
    "BTN": (90.4, 27.4), "CAF": (20.5, 6.6), "CAN": (-106.3, 56.1), "CHE": (8.2, 46.8),
    "CHL": (-71.4, -35.7), "CHN": (104.2, 35.9), "CIV": (-5.6, 7.6), "CMR": (12.7, 5.7),
    "COD": (23.6, -2.9), "COG": (15.2, -0.8), "COL": (-74.3, 4.1), "CRI": (-84.1, 9.9),
    "CUB": (-79.5, 21.5), "CZE": (15.3, 49.8), "DEU": (10.4, 51.2), "DJI": (42.6, 11.7),
    "DNK": (9.4, 56.0), "DOM": (-70.5, 18.9), "DZA": (2.6, 28.2), "ECU": (-78.5, -1.4),
    "EGY": (30.3, 26.8), "ERI": (39.1, 15.2), "ESP": (-3.6, 40.2), "ETH": (39.6, 8.6),
    "FIN": (25.7, 64.5), "FJI": (178.0, -17.8), "FRA": (2.5, 46.6), "GAB": (11.8, -0.6),
    "GBR": (-2.0, 54.0), "GEO": (43.5, 42.2), "GHA": (-1.2, 7.9), "GIN": (-11.0, 10.4),
    "GMB": (-15.4, 13.4), "GNB": (-14.9, 12.0), "GNQ": (10.3, 1.6), "GRC": (22.5, 39.1),
    "GTM": (-90.4, 15.7), "GUY": (-58.9, 4.8), "HND": (-86.6, 14.8), "HTI": (-72.7, 19.1),
    "HUN": (19.4, 47.2), "IDN": (117.3, -0.8), "IND": (78.9, 22.9), "IRL": (-8.1, 53.2),
    "IRN": (53.7, 32.6), "IRQ": (43.7, 33.0), "ISL": (-18.6, 65.0), "ISR": (34.9, 31.4),
    "ITA": (12.1, 42.8), "JAM": (-77.3, 18.1), "JOR": (36.8, 31.3), "JPN": (138.5, 36.6),
    "KAZ": (66.9, 48.2), "KEN": (37.9, -0.0), "KGZ": (74.6, 41.3), "KHM": (104.9, 12.7),
    "KOR": (127.8, 36.5), "KWT": (47.6, 29.3), "LAO": (103.8, 19.9), "LBN": (35.9, 33.9),
    "LBR": (-9.3, 6.5), "LBY": (17.3, 27.0), "LKA": (80.7, 7.9), "LSO": (28.2, -29.6),
    "MAR": (-6.3, 31.9), "MDA": (28.5, 47.2), "MDG": (46.7, -19.0), "MEX": (-102.5, 23.6),
    "MKD": (21.7, 41.6), "MLI": (-3.5, 17.4), "MMR": (96.5, 21.2), "MNE": (19.2, 42.8),
    "MNG": (103.1, 46.8), "MOZ": (35.5, -18.7), "MRT": (-10.3, 20.3), "MWI": (34.3, -13.3),
    "MYS": (102.0, 4.2), "NAM": (17.2, -22.1), "NER": (9.4, 17.6), "NGA": (8.1, 9.1),
    "NIC": (-85.0, 12.9), "NLD": (5.6, 52.2), "NOR": (9.6, 61.0), "NPL": (84.1, 28.3),
    "NZL": (172.8, -41.5), "OMN": (56.1, 21.0), "PAK": (69.4, 30.0), "PAN": (-80.1, 8.5),
    "PER": (-74.4, -9.2), "PHL": (122.9, 11.8), "PNG": (145.2, -6.5), "POL": (19.4, 52.1),
    "PRK": (127.2, 40.3), "PRT": (-8.2, 39.6), "PRY": (-58.4, -23.4), "QAT": (51.2, 25.3),
    "ROU": (25.0, 45.9), "RUS": (97.1, 64.7), "RWA": (29.9, -2.0), "SAU": (45.1, 24.0),
    "SDN": (30.2, 15.6), "SEN": (-14.4, 14.4), "SLE": (-11.8, 8.6), "SLV": (-88.9, 13.7),
    "SOM": (45.9, 6.0), "SRB": (20.8, 44.2), "SSD": (30.3, 7.3), "SUR": (-55.9, 4.1),
    "SVK": (19.5, 48.7), "SVN": (14.8, 46.1), "SWE": (16.3, 62.8), "SWZ": (31.5, -26.5),
    "SYR": (38.5, 35.0), "TCD": (18.7, 15.4), "TGO": (1.0, 8.5), "THA": (101.0, 15.1),
    "TJS": (71.0, 38.9), "TKM": (59.4, 39.1), "TLS": (125.9, -8.8), "TTO": (-61.3, 10.5),
    "TUN": (9.6, 34.1), "TUR": (35.2, 39.0), "TWN": (121.0, 23.7), "TZA": (34.9, -6.4),
    "UGA": (32.4, 1.3), "UKR": (31.2, 49.0), "URY": (-56.0, -32.8), "USA": (-98.6, 39.8),
    "UZB": (63.2, 41.8), "VEN": (-66.2, 7.1), "VNM": (106.3, 16.6), "YEM": (47.6, 15.6),
    "ZAF": (24.7, -29.0), "ZMB": (27.8, -13.5), "ZWE": (29.8, -19.0),
}


def _r(value: Decimal | float | None, ndigits: int = 2) -> float | None:
    return None if value is None else round(float(value), ndigits)


def _latest_quarter(conn) -> tuple[int, str]:
    row = conn.execute("SELECT id, label FROM quarters ORDER BY id DESC LIMIT 1").fetchone()
    if row is None:
        raise SystemExit("no quarters loaded — run `rw-ingest ingest` first")
    return int(row[0]), str(row[1])


def _pipeline_stats(conn) -> dict:
    row = conn.execute(
        """
        SELECT (SELECT COUNT(*) FROM quotes),
               (SELECT COUNT(*) FROM quarters),
               (SELECT label FROM quarters ORDER BY id ASC LIMIT 1),
               (SELECT label FROM quarters ORDER BY id DESC LIMIT 1),
               (SELECT COUNT(*) FROM corridors),
               (SELECT COUNT(*) FROM providers),
               (SELECT COUNT(*) FROM countries)
        """
    ).fetchone()
    return {
        "quotes": int(row[0]),
        "quarters": int(row[1]),
        "first_quarter": row[2],
        "last_quarter": row[3],
        "corridors": int(row[4]),
        "providers": int(row[5]),
        "countries": int(row[6]),
    }


def _computed(conn, quarter_id: int, quarter_label: str) -> dict:
    """Latest-quarter, $200-tier statistics computed from our own dataset."""
    digital = ", ".join(f"'{ap}'" for ap in DIGITAL_ACCESS_POINTS)
    row = conn.execute(
        f"""
        WITH q200 AS (
            SELECT * FROM quotes
            WHERE quarter_id = %s AND amount_usd = 200 AND total_cost_pct IS NOT NULL
        )
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE transparent),
               COUNT(*) FILTER (WHERE NOT transparent),
               AVG(total_cost_pct) FILTER (WHERE transparent),
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_cost_pct) FILTER (WHERE transparent),
               PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total_cost_pct) FILTER (WHERE transparent),
               AVG(total_cost_pct) FILTER (WHERE transparent AND access_point IN ({digital})),
               AVG(total_cost_pct) FILTER (WHERE transparent AND access_point IS NOT NULL
                                           AND access_point NOT IN ({digital})),
               COUNT(*) FILTER (WHERE transparent AND access_point IN ({digital})),
               COUNT(*) FILTER (WHERE transparent AND access_point IS NOT NULL
                                AND access_point NOT IN ({digital}))
        FROM q200
        """,
        (quarter_id,),
    ).fetchone()

    band_rows = conn.execute(
        """
        SELECT CASE WHEN total_cost_pct < 3 THEN 3
                    WHEN total_cost_pct < 6 THEN 6
                    WHEN total_cost_pct < 9 THEN 9
                    WHEN total_cost_pct < 12 THEN 12
                    WHEN total_cost_pct < 15 THEN 15
                    ELSE NULL END AS band,
               COUNT(*)
        FROM quotes
        WHERE quarter_id = %s AND amount_usd = 200 AND transparent AND total_cost_pct IS NOT NULL
        GROUP BY 1 ORDER BY 1 NULLS LAST
        """,
        (quarter_id,),
    ).fetchall()
    bands_by_upper = {row[0]: int(row[1]) for row in band_rows}
    cost_bands = [
        {"up_to_pct": bound, "quotes": bands_by_upper.get(bound, 0)} for bound in COST_BANDS
    ]
    cost_bands.append({"up_to_pct": None, "quotes": bands_by_upper.get(None, 0)})

    return {
        "quarter": quarter_label,
        "amount_usd": 200,
        "quotes_total": int(row[0]),
        "transparent_quotes": int(row[1]),
        "non_transparent_quotes": int(row[2]),
        "avg_total_cost_pct": _r(row[3]),
        "median_total_cost_pct": _r(row[4]),
        "p90_total_cost_pct": _r(row[5]),
        "digital_avg_pct": _r(row[6]),
        "cash_avg_pct": _r(row[7]),
        "digital_quotes": int(row[8]),
        "cash_quotes": int(row[9]),
        "cost_bands": cost_bands,
    }


def _anatomy(conn, quarter_id: int, quarter_label: str) -> dict | None:
    """The costliest transparent $200 quote of the latest quarter — a real,
    current worst deal, picked deterministically for the fee-dissection story.
    Quotes at or above 100% total cost are excluded: when more than the whole
    transfer evaporates in fees the row is a workbook artifact, not a deal —
    those belong in the explorer's flag list, not featured on the landing page."""
    row = conn.execute(
        """
        SELECT c.source_iso3, c.dest_iso3, cs.name, cd.name, p.name,
               qu.instrument, qu.currency_code, qu.lcu_amount, qu.total_cost_pct,
               qu.fx_margin_pct, qu.fee_lcu
        FROM quotes qu
        JOIN quarters q  ON q.id = qu.quarter_id
        JOIN corridors c ON c.id = qu.corridor_id
        JOIN countries cs ON cs.iso3 = c.source_iso3
        JOIN countries cd ON cd.iso3 = c.dest_iso3
        JOIN providers p ON p.id = qu.provider_id
        WHERE q.id = %s AND qu.amount_usd = 200 AND qu.transparent
          AND qu.total_cost_pct IS NOT NULL AND qu.total_cost_pct < 100
          AND qu.fx_margin_pct IS NOT NULL
          AND qu.lcu_amount > 0 AND qu.fee_lcu IS NOT NULL
        ORDER BY qu.total_cost_pct DESC, qu.id ASC
        LIMIT 1
        """,
        (quarter_id,),
    ).fetchone()
    if row is None:
        return None
    total = float(row[8])
    fee = float(row[10]) / float(row[7]) * 100
    margin = float(row[9])
    return {
        "from_iso3": row[0],
        "to_iso3": row[1],
        "from_name": row[2],
        "to_name": row[3],
        "provider": row[4],
        "instrument": row[5],
        "currency": row[6],
        "amount_usd": 200,
        "lcu_amount": _r(row[7], 0),
        "total_cost_pct": _r(total),
        "fee_pct": _r(fee),
        "margin_pct": _r(margin),
        "arrives_pct": _r(100 - total),
        "quarter": quarter_label,
    }


def _top_corridors(conn, quarter_id: int, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT c.source_iso3, c.dest_iso3, cs.name, cd.name,
               COUNT(*) AS quotes, AVG(qu.total_cost_pct)
        FROM quotes qu
        JOIN corridors c  ON c.id = qu.corridor_id
        JOIN countries cs ON cs.iso3 = c.source_iso3
        JOIN countries cd ON cd.iso3 = c.dest_iso3
        WHERE qu.quarter_id = %s AND qu.amount_usd = 200 AND qu.transparent
              AND qu.total_cost_pct IS NOT NULL
        GROUP BY 1, 2, 3, 4, c.code
        ORDER BY quotes DESC, c.code ASC
        LIMIT %s
        """,
        (quarter_id, limit),
    ).fetchall()

    corridors = []
    for src, dst, src_name, dst_name, quotes, avg in rows:
        entry = {
            "from_iso3": src,
            "to_iso3": dst,
            "from_name": src_name,
            "to_name": dst_name,
            "quotes": int(quotes),
            "avg_cost_pct": _r(avg),
        }
        if src in COUNTRY_COORDS and dst in COUNTRY_COORDS:
            entry["from_ll"] = list(COUNTRY_COORDS[src])
            entry["to_ll"] = list(COUNTRY_COORDS[dst])
        corridors.append(entry)
    return corridors


def build_site_data(conn) -> dict:
    quarter_id, quarter_label = _latest_quarter(conn)
    pipeline = _pipeline_stats(conn)
    if pipeline["quotes"] == 0:
        raise SystemExit("dataset is empty — run `rw-ingest ingest` before exporting site data")
    return {
        "meta": {
            "generated_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "generator": "rw-ingest export-site-data",
            "source": SOURCE,
        },
        "pipeline": pipeline,
        "cited": CITED,
        "computed": _computed(conn, quarter_id, quarter_label),
        "anatomy": _anatomy(conn, quarter_id, quarter_label),
        "top_corridors": _top_corridors(conn, quarter_id, TOP_CORRIDOR_COUNT),
        "roadmap": ROADMAP,
    }


def export_site_data(conn, out: Path) -> Path:
    payload = build_site_data(conn)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return out
