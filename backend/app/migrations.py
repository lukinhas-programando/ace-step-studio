from __future__ import annotations

from typing import Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def _get_columns(conn: AsyncConnection, table: str) -> set[str]:
    result = await conn.execute(text(f"PRAGMA table_info('{table}')"))
    return {row[1] for row in result}


async def _ensure_column(conn: AsyncConnection, table: str, column_def: str, column_name: str) -> None:
    columns = await _get_columns(conn, table)
    if column_name in columns:
        return
    await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_def}"))


async def run_migrations(conn: AsyncConnection) -> None:
    await _ensure_column(conn, "generations", "cover_color VARCHAR(16)", "cover_color")
    await _ensure_column(conn, "generations", "cover_icon VARCHAR(32)", "cover_icon")
    await _ensure_column(conn, "generations", "cover_image_path VARCHAR", "cover_image_path")
