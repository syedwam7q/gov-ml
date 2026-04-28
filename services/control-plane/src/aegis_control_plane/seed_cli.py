"""CLI wrapper around `seed_hero_scenario` + `seed_datasets`.

Used by:

  * `setup.md`'s 90-second quick start (one-liner via
    `python -m aegis_control_plane.seed_cli`)
  * Any operator who wants to (re-)seed the demo data without
    pasting the inline `asyncio.run(...)` block.

Idempotent — calling twice is a no-op (each seed function checks for
the hero decision's fixed UUID before inserting).
"""

from __future__ import annotations

import asyncio
import logging

from aegis_control_plane.db import make_engine, make_session_factory
from aegis_control_plane.seed import seed_datasets, seed_hero_scenario

_log = logging.getLogger(__name__)


async def _main() -> None:
    engine = make_engine()
    factory = make_session_factory(engine)
    try:
        async with factory() as session:
            seeded = await seed_hero_scenario(session)
            datasets = await seed_datasets(session)
            await session.commit()
        if seeded:
            print("✓ Hero scenario seeded (Apple Card 2019).")
        else:
            print("· Hero scenario already present — skipped.")
        print(f"✓ {datasets} dataset(s) ensured.")
    finally:
        await engine.dispose()


def run() -> None:
    """Entrypoint for `python -m aegis_control_plane.seed_cli`."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(_main())


if __name__ == "__main__":
    run()
