"""Pure normalizers for RPW cell values — every upstream quirk handled here.

Kept free of I/O so contract tests can pin behavior against the research
findings in ``docs/research/01-rpw-dataset.md``.
"""

import hashlib
import re
from decimal import Decimal, InvalidOperation

# Source period spelling: 2016_2Q … 2025_3Q ('2025_2Q' famously does not exist).
_PERIOD_RE = re.compile(r"^(\d{4})_([1-4])Q$")

# Instrument tokens arrive with inconsistent casing ('Credit Card' / 'Credit card')
# and comma-combos ('Cash,Mobile money'). Normalize token-by-token, preserve combos.
_SEPARATOR_RE = re.compile(r"\s*,\s*")


def parse_period(value: object) -> int:
    """'2025_3Q' -> 20253 (year * 10 + quarter). Raises loudly on drift."""
    text = _text(value)
    match = _PERIOD_RE.match(text)
    if match is None:
        msg = f"unexpected period value {value!r} — upstream format may have changed"
        raise ValueError(msg)
    year, qtr = int(match.group(1)), int(match.group(2))
    return year * 10 + qtr


def normalize_instrument(value: object) -> str:
    """Normalize casing inside comma-separated instrument combos."""
    text = _text(value)
    if not text:
        return ""
    tokens = (_SEPARATOR_RE.split(text))
    return ", ".join(_title(token) for token in tokens if token)


def _title(token: str) -> str:
    return token[:1].upper() + token[1:].lower()


def parse_decimal(value: object) -> Decimal | None:
    """Cell -> Decimal. Blank becomes None; anything unparseable raises loudly.

    Never float: money goes into NUMERIC columns, and float would lose cents.
    """
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    text = _text(value)
    if not text:
        return None
    try:
        return Decimal(text.replace(",", "").strip())
    except InvalidOperation as exc:
        msg = f"unparseable numeric cell {value!r}"
        raise ValueError(msg) from exc


def parse_bool_transparent(value: object) -> bool:
    """transparent column -> bool. Anything unexpected raises loudly."""
    text = _text(value).lower()
    if text == "yes":
        return True
    if text == "no":
        return False
    msg = f"unexpected transparent value {value!r}"
    raise ValueError(msg)


def row_hash(cells: tuple) -> str:
    """Stable sha256 over the full source row — the idempotency key.

    Any change anywhere in the row (WB revising a number, adding a column)
    produces a new hash, so corrections flow in as updates on next ingest.
    """
    joined = "\x1f".join("" if c is None else _cell_text(c) for c in cells)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _cell_text(cell: object) -> str:
    if isinstance(cell, float):
        # openpyxl hands back floats for whole numbers (2257.0); canonicalize so
        # 2257 and 2257.0 hash identically.
        if cell.is_integer():
            return str(int(cell))
        return repr(cell)
    return str(cell)


def _text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()
