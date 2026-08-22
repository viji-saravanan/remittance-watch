"""Resolve + download the current RPW workbook from the World Bank Data Catalog.

Verified live 2026-08 against the official DDH OpenAPI (no auth, no key):
``https://ddh-openapi.worldbank.org/datasets/0037898``. The resource id
(``DR…``) changes between releases — it is re-resolved on every fetch, never
hardcoded (docs/research/01-rpw-dataset.md).
"""

import hashlib
import json
import re
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

DATASET_URL = "https://ddh-openapi.worldbank.org/datasets/0037898"
DOWNLOAD_PROXY = "https://ddh-openapi.worldbank.org/resources/{rid}/download"

# The filename encodes the release (rpw_dataset_2011_2025_q3.xlsx today); match
# the shape, not the name.
XLSX_NAME_RE = re.compile(r"^rpw_dataset_.+\.xlsx$", re.IGNORECASE)

CHUNK = 1 << 20


class CatalogError(Exception):
    pass


@dataclass(slots=True)
class WorkbookResource:
    resource_id: str
    url: str
    name: str
    modified_on: str | None

    @property
    def suggested_filename(self) -> str:
        return Path(self.url.split("?")[0]).name if self.url.endswith(".xlsx") else f"{self.resource_id}.xlsx"


def resolve_latest() -> WorkbookResource:
    """Pick the newest xlsx resource for dataset 0037898.

    The display name is prose ("Remittance Prices Worldwide (Complete Dataset)");
    the release signature lives in the URL's filename (rpw_dataset_2011_2025_q3.xlsx).
    Resources are listed oldest-first, so the last match is the newest.
    """
    payload = _get_json(DATASET_URL)
    candidates = []
    for resource in payload.get("resources", []):
        url = resource.get("url")
        if not url:
            continue  # pending/draft entries carry null urls
        filename = Path(str(url).split("?")[0]).name
        if not XLSX_NAME_RE.match(filename):
            continue
        candidates.append(
            WorkbookResource(
                resource_id=str(resource.get("resource_unique_id", "")),
                url=str(url),
                name=str(resource.get("name", "")),
                modified_on=resource.get("last_updated_date") or payload.get("modified_on"),
            )
        )
    if not candidates:
        raise CatalogError(
            "no downloadable xlsx resource found via " + DATASET_URL +
            " — catalog layout may have changed; inspect resources[] manually"
        )
    return candidates[-1]


def download(resource: WorkbookResource, dest: Path) -> str:
    """Stream the workbook to dest; returns sha256. Falls back to the proxy URL."""
    urls = [resource.url, DOWNLOAD_PROXY.format(rid=resource.resource_id)]
    dest.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for url in urls:
        try:
            digest = _stream_to_file(url, dest, resource)
        except Exception as exc:  # try next URL; report both if all fail
            last_error = exc
            continue
        return digest
    raise CatalogError(f"download failed from {urls}: {last_error}")


def _stream_to_file(url: str, dest: Path, resource: WorkbookResource) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "remitwatch-ingest/0.1"})
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(request) as response, dest.open("wb") as out:
        while chunk := response.read(CHUNK):
            out.write(chunk)
            digest.update(chunk)
            size += len(chunk)
            print(f"\r  {size/1e6:.1f} MB", end="", flush=True, file=sys.stderr)
    print(file=sys.stderr)
    if size == 0:
        raise CatalogError(f"empty response for {url}")
    print(
        f"  sha256 {digest.hexdigest()} ({size} bytes) [{resource.resource_id}]",
        file=sys.stderr,
    )
    return digest.hexdigest()


def _get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "remitwatch-ingest/0.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))
