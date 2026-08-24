"""rw-ingest — one command from World Bank workbook to tested Postgres dataset.

Subcommands:
    migrate   apply pending schema migrations
    fetch     resolve + download the current workbook from the catalog
    ingest    migrate + parse + load a workbook (the whole pipeline)
    verify    acceptance checks against the loaded data
"""

import argparse
import sys
from decimal import Decimal
from pathlib import Path

from . import catalog, db
from .loader import ingest_rows
from .migrations import apply_migrations
from .parser import MathAudit, parse_workbook

# Full-release baseline is ~85 violations / 401k tiers ≈ 0.02%, all 2016–2020.
# 1% means something structurally changed upstream — investigate, don't ingest.
MATH_VIOLATION_RATE_LIMIT = Decimal("1.00")
EXIT_MATH_DRIFT = 4


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="rw-ingest",
        description="World Bank RPW ingestion pipeline",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("migrate", help="apply pending schema migrations")

    p_fetch = sub.add_parser("fetch", help="download the current workbook")
    p_fetch.add_argument("--out", type=Path, default=Path("var/rpw.xlsx"))

    p_ingest = sub.add_parser("ingest", help="migrate + parse + load")
    p_ingest.add_argument("--file", type=Path, help="workbook path (skips download)")
    p_ingest.add_argument(
        "--download", action="store_true",
        help="resolve + download the current release to var/ first",
    )
    p_ingest.add_argument(
        "--strict", action="store_true",
        help="abort on the first decomposition-identity violation instead of recording it",
    )

    sub.add_parser("verify", help="run acceptance checks on the loaded data")

    p_export = sub.add_parser(
        "export-site-data",
        help="emit the versioned JSON the website renders (real data only, no hardcodes)",
    )
    p_export.add_argument(
        "--out", type=Path, default=Path("app/data/site-data.json"),
        help="output path relative to the repo root (default: app/data/site-data.json)",
    )

    p_explorer = sub.add_parser(
        "export-explorer",
        help="emit the versioned corridor-explorer bundle (public/data/rpw-explorer-v1.json, ADR-0008)",
    )
    p_explorer.add_argument(
        "--out", type=Path, default=Path("public/data/rpw-explorer-v1.json"),
        help="output path relative to the repo root (default: public/data/rpw-explorer-v1.json)",
    )

    args = parser.parse_args(argv)

    if args.command == "migrate":
        _migrate()
    elif args.command == "fetch":
        _fetch(args.out)
    elif args.command == "ingest":
        return _ingest(args.file, args.download, args.strict)
    elif args.command == "verify":
        _verify()
    elif args.command == "export-site-data":
        _export_site_data(args.out)
    elif args.command == "export-explorer":
        _export_explorer(args.out)
    return 0


def _migrate() -> None:
    with db.connect(autocommit=True) as conn:
        ran = apply_migrations(conn)
    print(f"applied: {ran or 'nothing pending'}")


def _fetch(out: Path) -> None:
    resource = catalog.resolve_latest()
    print(f"latest: {resource.resource_id} — {resource.name} (modified {resource.modified_on})")
    print(f"from:   {resource.url}")
    digest = catalog.download(resource, out)
    print(f"saved:  {out}")
    print(f"sha256: {digest}")
    _record_provenance(resource, digest, out)


def _ingest(file: Path | None, download_first: bool, strict: bool = False) -> int:
    if file is None and not download_first:
        print("error: pass --file PATH or --download", file=sys.stderr)
        return 2
    if file is None:
        path = Path("var/rpw.xlsx")
        _fetch(path)
    else:
        path = file
        if not path.exists():
            print(f"error: no such file: {path}", file=sys.stderr)
            return 2

    _migrate()
    audit = None if strict else MathAudit()
    with db.connect() as conn:
        stats = ingest_rows(conn, parse_workbook(path, audit=audit))
    print(stats.summary())
    if audit is not None and audit.violation_count:
        print(audit.report())
        print("first violations (row, corridor, tier, computed%, published%):")
        for v in audit.violations[:10]:
            print(
                f"  row {v.row_number} {v.source_iso3}->{v.destination_iso3} {v.tier}: "
                f"{v.expected_pct:.4f} vs published {v.published_pct}"
            )
        if audit.violation_rate() > MATH_VIOLATION_RATE_LIMIT:
            print(
                f"error: violation rate {audit.violation_rate():.4f}% exceeds the "
                f"{MATH_VIOLATION_RATE_LIMIT}% guardrail — upstream format likely drifted",
                file=sys.stderr,
            )
            return EXIT_MATH_DRIFT
    return 0


def _record_provenance(resource: catalog.WorkbookResource, digest: str, path: Path) -> None:
    """Append a line to var/provenance.log — the raw material for docs/data-provenance.md."""
    log = path.parent / "provenance.log"
    with log.open("a", encoding="utf-8") as fh:
        fh.write(f"{digest}  {resource.resource_id}  {resource.name}  {resource.modified_on}\n")


def _export_site_data(out: Path) -> None:
    from .site_export import export_site_data

    if not out.is_absolute():
        # the default (and any relative path) is repo-relative, so the command
        # works the same from pipeline/ as from the repo root
        out = Path(__file__).resolve().parents[3] / out
    with db.connect() as conn:
        written = export_site_data(conn, out)
    print(f"wrote: {written}")
    print("the site imports this file at build time — regenerate after every re-ingest")


def _export_explorer(out: Path) -> None:
    from .explorer_export import export_explorer_data

    if not out.is_absolute():
        out = Path(__file__).resolve().parents[3] / out  # repo-relative, same rule as site data
    with db.connect() as conn:
        written = export_explorer_data(conn, out)
    print(f"wrote: {written}")
    print("the explorer fetches this bundle at runtime — regenerate after every re-ingest")


def _verify() -> None:
    """The milestone's acceptance question, answered in SQL:
    *for corridor X, amount Y — each provider's cost, decomposed into fee vs FX margin.*
    """
    with db.connect() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT q.label, COUNT(*) AS quotes,
                   COUNT(*) FILTER (WHERE NOT qu.transparent) AS non_transparent
            FROM quotes qu JOIN quarters q ON q.id = qu.quarter_id
            GROUP BY q.label ORDER BY q.label DESC LIMIT 3
            """
        )
        print("latest quarters by quote count:")
        for label, count, non_transparent in cur.fetchall():
            print(f"  {label}: {count} quotes ({non_transparent} non-transparent)")

        cur.execute(
            """
            SELECT c.code, p.name, qu.instrument, qu.amount_usd,
                   qu.fee_lcu / NULLIF(qu.lcu_amount, 0) * 100 AS fee_pct,
                   qu.fx_margin_pct, qu.total_cost_pct, qu.currency_code
            FROM quotes qu
            JOIN quarters q   ON q.id = qu.quarter_id
            JOIN corridors c  ON c.id = qu.corridor_id
            JOIN providers p  ON p.id = qu.provider_id
            WHERE q.id = (SELECT MAX(id) FROM quarters)
              AND qu.transparent AND qu.lcu_amount IS NOT NULL
            ORDER BY qu.total_cost_pct ASC LIMIT 5
            """
        )
        print("\ncheapest transparent quotes, latest quarter (fee% + margin% = total%):")
        for code, name, instrument, amount, fee_pct, margin, total, ccy in cur.fetchall():
            print(
                f"  {code} ${amount:.0f} {name} [{instrument}]: "
                f"{fee_pct:.2f}% fee {ccy} | margin {margin}% | total {total}%"
            )


if __name__ == "__main__":
    raise SystemExit(main())
