"""Database connection helpers.

DATABASE_URL is the single knob (postgres:// or postgresql://). The database
itself is an ephemeral transform workspace — local docker compose or a CI
service container (ADR-0005); nothing here ever points at a hosted account.
"""

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from psycopg import Connection


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        msg = (
            "DATABASE_URL is not set. Local default: "
            "postgres://rw:rw@localhost:5433/rw (see pipeline/docker-compose.yml)"
        )
        raise SystemExit(msg)
    return url


def connect(url: str | None = None, *, autocommit: bool = False) -> "Connection":
    from psycopg import connect as pg_connect

    return pg_connect(url or database_url(), autocommit=autocommit)
