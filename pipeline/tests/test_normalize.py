"""Unit tests for the pure normalizers — pin every documented upstream quirk."""

from decimal import Decimal

import pytest

from remittance_watch.normalize import (
    normalize_instrument,
    parse_bool_transparent,
    parse_decimal,
    parse_period,
    row_hash,
)


class TestPeriod:
    def test_known_shape(self):
        assert parse_period("2025_3Q") == 20253
        assert parse_period("2016_2Q") == 20162

    @pytest.mark.parametrize("bad", ["2025_2q", "25_3Q", "2025_5Q", "", None, "Q3 2025"])
    def test_drift_raises(self, bad):
        with pytest.raises(ValueError):
            parse_period(bad)


class TestInstrument:
    def test_casing_normalized(self):
        assert normalize_instrument("Credit Card") == "Credit card"
        assert normalize_instrument("credit card") == "Credit card"

    def test_combo_preserved_and_normalized(self):
        assert normalize_instrument("Cash,Mobile money") == "Cash, Mobile money"
        assert normalize_instrument("Bank account , Credit CARD") == "Bank account, Credit card"

    def test_blank(self):
        assert normalize_instrument(None) == ""
        assert normalize_instrument("  ") == ""


class TestDecimal:
    def test_numbers_and_strings(self):
        assert parse_decimal(2257.2) == Decimal("2257.2")
        assert parse_decimal(45000) == Decimal("45000")
        assert parse_decimal(" 12,500 ") == Decimal("12500")

    def test_blank_is_none(self):
        assert parse_decimal(None) is None
        assert parse_decimal("") is None

    def test_garbage_raises_loudly(self):
        with pytest.raises(ValueError):
            parse_decimal("#VALUE!")

    def test_never_float_precision_loss(self):
        assert parse_decimal("0.1").as_tuple().digits == (1,)
        assert str(parse_decimal("33000.00")) == "33000.00"


class TestTransparent:
    def test_yes_no(self):
        assert parse_bool_transparent("yes") is True
        assert parse_bool_transparent("No") is False

    def test_drift_raises(self):
        with pytest.raises(ValueError):
            parse_bool_transparent("unknown")


class TestRowHash:
    def test_int_and_float_forms_hash_identically(self):
        cells_a = (900001, "2025_3Q", 2257.0)
        cells_b = (900001, "2025_3Q", 2257)
        assert row_hash(cells_a) == row_hash(cells_b)

    def test_value_change_changes_hash(self):
        assert row_hash((1, 2)) != row_hash((1, 3))

    def test_none_and_empty_canonicalize_identically(self):
        # Both mean "no value" — a cell that is blank vs explicitly empty must
        # not manufacture phantom diffs on re-ingest.
        assert row_hash((None,)) == row_hash(("",))
