"""Shared fixtures. E2E tests need a Postgres; they self-provision `rw_test`
on whatever DATABASE_URL points at (default: the local compose container),
and skip cleanly when no server is reachable (so unit tests run anywhere).
"""

import os
from pathlib import Path

import psycopg
import pytest

FIXTURE_XLSX = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "rpw_contract.xlsx"

TEST_DB_URL_DEFAULT = "postgres://rw:rw@localhost:5433/rw"


def _server_available(url: str) -> bool:
    try:
        with psycopg.connect(url, connect_timeout=2):
            return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def db_url() -> str:
    url = os.environ.get("DATABASE_URL", TEST_DB_URL_DEFAULT)
    # Point at the throwaway test database, not whatever the env points at.
    url = _swap_dbname(url, "rw_test")
    if not _server_available(_admin_url(url)):
        if os.getenv("GITHUB_ACTIONS") == "true":
            # In CI the service container is supposed to be there; a skip here
            # would exit 0 with ZERO e2e coverage of exactly the tests that
            # guard published numbers — a green job must mean they ran.
            pytest.fail(f"Postgres unreachable in CI at {url} — e2e suite cannot silently pass")
        pytest.skip("no Postgres reachable for e2e tests")
    _recreate_db(_admin_url(url), "rw_test")
    yield url
    _drop_db(_admin_url(url), "rw_test")


def _swap_dbname(url: str, dbname: str) -> str:
    base = url.rsplit("/", 1)[0]
    return f"{base}/{dbname}"


def _admin_url(url: str) -> str:
    return _swap_dbname(url, "postgres")


def _recreate_db(admin_url: str, name: str) -> None:
    with psycopg.connect(admin_url, autocommit=True) as conn:
        conn.execute(f'DROP DATABASE IF EXISTS "{name}"')  # noqa: S608 — literal
        conn.execute(f'CREATE DATABASE "{name}"')  # noqa: S608 — literal


def _drop_db(admin_url: str, name: str) -> None:
    with psycopg.connect(admin_url, autocommit=True) as conn:
        conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')  # noqa: S608 — literal


@pytest.fixture(scope="session")
def migrated_conn(db_url):
    """A session connection with schema v1 applied."""
    from remittance_watch.db import connect
    from remittance_watch.migrations import apply_migrations

    conn = connect(db_url)
    apply_migrations(conn)
    yield conn
    conn.close()


@pytest.fixture()
def clean_db(migrated_conn):
    """Empty dimension/quote tables around each e2e test (schema stays)."""
    with migrated_conn.cursor() as cur:
        cur.execute("TRUNCATE quotes, corridors, providers, quarters, countries CASCADE")
    migrated_conn.commit()
    yield migrated_conn
    migrated_conn.rollback()


@pytest.fixture(scope="session")
def fixture_path() -> Path:
    assert FIXTURE_XLSX.exists(), f"contract fixture missing: {FIXTURE_XLSX}"
    return FIXTURE_XLSX
