"""Catalog resolver tests against the REAL response shape captured live
2026-08-22 (see docs/data-provenance.md). No network — _get_json is faked."""

import json
from pathlib import Path

import pytest

from remittance_watch import catalog
from remittance_watch.catalog import CatalogError, WorkbookResource, resolve_latest

# Verbatim structure from GET https://ddh-openapi.worldbank.org/datasets/0037898
# (subset; prose descriptions elided).
LIVE_SHAPE = {
    "dataset_id": "0037898",
    "name": "Remittance Prices Worldwide",
    "modified_on": "2026-05-06T14:46:56+00:00",
    "resources": [
        {
            "resource_id": "41ef550e-1479-f011-b4cb-000d3a3b8890",
            "resource_unique_id": "DR0095523",
            "name": "Remittance Prices Worldwide (Complete Dataset)",
            "url": "https://datacatalogfiles.worldbank.org/ddh-published/0037898/DR0095523/rpw_dataset_2011_2025_q3.xlsx",
            "format": "EXCEL",
        },
        {
            "resource_unique_id": "DR0095524",
            "name": "Remittance Prices Worldwide (Sending Countries)",
            "url": None,  # DATABANK entries carry null urls
            "format": "DATABANK",
        },
        {
            "resource_unique_id": "DR0095413",
            "name": "Remittance Prices Worldwide (Quarterly Report)",
            "url": "https://datacatalogfiles.worldbank.org/ddh-published/0037898/DR0095413/RPW_main_report_and_annex_Q325.pdf",
            "format": "PDF",
        },
    ],
}


@pytest.fixture()
def fake_catalog(monkeypatch):
    def _install(payload):
        monkeypatch.setattr(catalog, "_get_json", lambda url: payload)

    return _install


def test_picks_xlsx_by_url_filename_not_display_name(fake_catalog):
    fake_catalog(LIVE_SHAPE)
    resource = resolve_latest()
    assert resource.url.endswith("/rpw_dataset_2011_2025_q3.xlsx")
    assert resource.resource_id == "DR0095523"
    assert resource.name == "Remittance Prices Worldwide (Complete Dataset)"


def test_modified_on_falls_back_to_dataset_level(fake_catalog):
    fake_catalog(LIVE_SHAPE)
    # Resources carry no date field; dataset modified_on is the release date.
    assert resolve_latest().modified_on == "2026-05-06T14:46:56+00:00"


def test_skips_null_urls_and_non_xlsx(fake_catalog):
    fake_catalog(LIVE_SHAPE)
    resource = resolve_latest()  # would raise if PDF/null-url entries were candidates
    assert resource.url.endswith(".xlsx")


def test_last_candidate_wins_when_multiple_releases(fake_catalog):
    payload = json.loads(json.dumps(LIVE_SHAPE))  # deep copy
    payload["resources"].insert(0, {
        "resource_unique_id": "DR0000001",
        "name": "Remittance Prices Worldwide (Complete Dataset)",
        "url": "https://example.com/rpw_dataset_2011_2024_q4.xlsx",
        "format": "EXCEL",
    })
    fake_catalog(payload)
    assert resolve_latest().resource_id == "DR0095523"  # newest listed last


def test_raises_when_no_xlsx(fake_catalog):
    payload = {"resources": [{"name": "Report", "url": "https://x/y.pdf"}]}
    fake_catalog(payload)
    with pytest.raises(CatalogError, match="no downloadable xlsx"):
        resolve_latest()


def test_suggested_filename_from_url():
    r = WorkbookResource(
        resource_id="DR0095523",
        url="https://host/ddh-published/0037898/DR0095523/rpw_dataset_2011_2025_q3.xlsx",
        name="n", modified_on=None,
    )
    assert r.suggested_filename == "rpw_dataset_2011_2025_q3.xlsx"
