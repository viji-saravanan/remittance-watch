"""Versioned schema migrations — plain SQL files applied in filename order.

Each file under ``remittance_watch/migrations/`` runs at most once, inside its
own transaction, tracked in ``schema_migrations``. No ORM, no framework: the
files are the schema's source of truth and remain portable to any Postgres
(the portability hook ADR-0004/0005 rely on).
"""

from importlib import resources
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from psycopg import Connection

MIGRATIONS_PACKAGE = "migrations"


def apply_migrations(conn: "Connection") -> list[str]:
    """Apply all pending migrations; returns filenames applied this run.

    Takes ownership of transaction semantics: autocommit is forced on so each
    file's ``transaction()`` block is a real BEGIN/COMMIT (psycopg otherwise
    nests savepoints inside an implicit transaction that may never commit).
    """
    conn.autocommit = True
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version    TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    applied = {version for version, in conn.execute("SELECT version FROM schema_migrations").fetchall()}

    ran: list[str] = []
    root = resources.files("remittance_watch") / MIGRATIONS_PACKAGE
    for entry in sorted(root.iterdir(), key=lambda e: e.name):
        name = entry.name
        if not name.endswith(".sql"):
            continue
        if name in applied:
            continue
        with conn.transaction():
            conn.execute(entry.read_text())
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (name,))
        ran.append(name)
    return ran


def pending(conn: "Connection") -> list[str]:
    """Filenames not yet applied (dry-run helper / drift check)."""
    conn.autocommit = True
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version    TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    applied = {version for version, in conn.execute("SELECT version FROM schema_migrations").fetchall()}
    root = resources.files("remittance_watch") / MIGRATIONS_PACKAGE
    return [
        entry.name
        for entry in sorted(root.iterdir(), key=lambda e: e.name)
        if entry.name.endswith(".sql") and entry.name not in applied
    ]
