"""Regenerate the committed contract fixture: tests/fixtures/rpw_contract.xlsx.

Run from pipeline/:  uv run python tests/make_fixture.py

The fixture replicates the REAL sheet's structure (exact 42-column header, one
row per provider x corridor x quarter x instrument, parallel cc1/cc2 blocks)
with a handful of hand-computed rows covering every ingestion rule:

row 1  transparent cash pair        -> verified decomposition math
row 2  NON-transparent bank         -> margin stored as lying 0, must become NULL downstream
row 3  mixed-case instrument combo  -> casing normalization
row 4  sparse optionals             -> blanks stay NULL, not ''
row 5  second quarter               -> multi-quarter idempotency
"""

from pathlib import Path

from openpyxl import Workbook

# Byte-for-byte the header extracted from rpw_dataset_2011_2025_q3.xlsx
# (`Dataset (from Q2 2016)` sheet, first 42 named columns).
HEADER = [
    "id", "period",
    "source_code", "source_name", "source_region", "source_income", "source_lending", "source_G8G20",
    "destination_code", "destination_name", "destination_region", "destination_income", "destination_lending", "destination_G8G20",
    "firm", "firm_type", "payment instrument", "access point", "speed actual",
    "cc1 lcu amount", "cc1 denomination amount", "cc1 lcu code", "cc1 lcu fee", "cc1 lcu fx rate", "cc1 fx margin", "cc1 total cost %",
    "cc2 lcu amount", "cc2 denomination amount", "cc2 lcu code", "cc2 lcu fee", "cc2 lcu fx rate", "cc2 fx margin", "cc2 total cost %",
    "inter lcu bank fx", "transparent", "Standard Note", "note2",
    "receiving network coverage", "pickup location", "pickup method", "date", "corridor",
]


def row(**kw):
    base = dict.fromkeys(HEADER)
    base.update(kw)
    return [base[name] for name in HEADER]


ROWS = [
    # 1 — Angola -> Namibia, cash, both tiers, transparent. Math checks:
    #     cc1: 2257.2 / 33000 * 100 = 6.84 + 3.10 = 9.94
    #     cc2: 5650.0 / 82500 * 100 = 6.85 + 3.10 = 9.95
    row(
        id=900001, period="2025_3Q",
        source_code="AGO", source_name="Angola", source_region="SSA", source_income="LM", source_lending="IDA", source_G8G20="",
        destination_code="NAM", destination_name="Namibia", destination_region="SSA", destination_income="UM", destination_lending="IBRD", destination_G8G20="",
        firm="Example MTO Ltd", firm_type="MTO", **{"payment instrument": "Cash"},
        **{"access point": "Bank", "speed actual": "1-3 days"},
        **{"cc1 lcu amount": 33000, "cc1 denomination amount": 200, "cc1 lcu code": "AOA", "cc1 lcu fee": 2257.2, "cc1 lcu fx rate": 165, "cc1 fx margin": 3.10, "cc1 total cost %": 9.94},
        **{"cc2 lcu amount": 82500, "cc2 denomination amount": 500, "cc2 lcu code": "AOA", "cc2 lcu fee": 5650.0, "cc2 lcu fx rate": 165, "cc2 fx margin": 3.10, "cc2 total cost %": 9.95},
        **{"inter lcu bank fx": 160.0}, transparent="yes",
        **{"Standard Note": "", "note2": ""},
    ),
    # 2 — Bank, NON-transparent: margins stored as literal 0 (a lie), notes say so.
    row(
        id=900002, period="2025_3Q",
        source_code="AGO", source_name="Angola", source_region="SSA", source_income="LM", source_lending="IDA", source_G8G20="",
        destination_code="ZAF", destination_name="South Africa", destination_region="SSA", destination_income="UM", destination_lending="IBRD", destination_G8G20="",
        firm="Example Bank NA", firm_type="Bank", **{"payment instrument": "Bank account"},
        **{"access point": "Branch", "speed actual": "3-5 days"},
        **{"cc1 lcu amount": 33000, "cc1 denomination amount": 200, "cc1 lcu code": "AOA", "cc1 lcu fee": 1400.0, "cc1 lcu fx rate": 165, "cc1 fx margin": 0, "cc1 total cost %": 4.24},
        **{"cc2 lcu amount": 82500, "cc2 denomination amount": 500, "cc2 lcu code": "AOA", "cc2 lcu fee": 2100.0, "cc2 lcu fx rate": 165, "cc2 fx margin": 0, "cc2 total cost %": 2.55},
        **{"inter lcu bank fx": 160.0}, transparent="no",
        **{"Standard Note": "FX margin unknown; 0 does not mean no cost.", "note2": ""},
    ),
    # 3 — Instrument casing combo variant.
    row(
        id=900003, period="2025_3Q",
        source_code="AGO", source_name="Angola", source_region="SSA", source_income="LM", source_lending="IDA", source_G8G20="",
        destination_code="NAM", destination_name="Namibia", destination_region="SSA", destination_income="UM", destination_lending="IBRD", destination_G8G20="",
        firm="Example Mobile SA", firm_type="MTO", **{"payment instrument": "Cash,mobile MONEY"},
        **{"access point": "", "speed actual": "Within 1 hour"},
        **{"cc1 lcu amount": 33000, "cc1 denomination amount": 200, "cc1 lcu code": "AOA", "cc1 lcu fee": 990.0, "cc1 lcu fx rate": 165, "cc1 fx margin": 2.50, "cc1 total cost %": 5.50},
        **{"cc2 lcu amount": 82500, "cc2 denomination amount": 500, "cc2 lcu code": "AOA", "cc2 lcu fee": 2400.0, "cc2 lcu fx rate": 165, "cc2 fx margin": 2.50, "cc2 total cost %": 5.41},
        **{"inter lcu bank fx": 160.0}, transparent="yes",
        **{"Standard Note": "", "note2": ""},
    ),
    # 4 — Sparse optionals everywhere; INR amounts (LCU equivalents of $200/$500).
    #     cc1: 350 / 16600 * 100 = 2.11 + 0.60 = 2.71
    #     cc2: 450 / 41500 * 100 = 1.08 + 0.60 = 1.68
    row(
        id=900004, period="2025_1Q",
        source_code="IND", source_name="India", source_region="SAS", source_income="LM", source_lending="IBRD", source_G8G20="G20",
        destination_code="NPL", destination_name="Nepal", destination_region="SAS", destination_income="LM", destination_lending="IDA", destination_G8G20="",
        firm="Example Remit Pte", firm_type="MTO", **{"payment instrument": "Bank account,Credit Card"},
        **{"access point": None, "speed actual": None},
        **{"cc1 lcu amount": 16600, "cc1 denomination amount": 200, "cc1 lcu code": "INR", "cc1 lcu fee": 350.0, "cc1 lcu fx rate": 83.0, "cc1 fx margin": 0.60, "cc1 total cost %": 2.71},
        **{"cc2 lcu amount": 41500, "cc2 denomination amount": 500, "cc2 lcu code": "INR", "cc2 lcu fee": 450.0, "cc2 lcu fx rate": 83.0, "cc2 fx margin": 0.60, "cc2 total cost %": 1.68},
        **{"inter lcu bank fx": 82.5}, transparent="yes",
        **{"Standard Note": None, "note2": None},
    ),
]


def main() -> None:
    out = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "rpw_contract.xlsx"
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Dataset (from Q2 2016)")
    ws.append(HEADER)
    for r in ROWS:
        ws.append(r)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print(f"wrote {out} ({len(ROWS)} data rows)")


if __name__ == "__main__":
    main()
