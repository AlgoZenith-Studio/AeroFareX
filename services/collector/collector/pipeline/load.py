"""Write one source's archived responses and observations in a single transaction."""
from __future__ import annotations

from sqlalchemy import Engine, insert, select

from server.models import fare_components, fare_observations, raw_observations

from ..adapters.base import Adapter
from ..storage.raw_archive import RawArchive, batch_hash, sha256_hex
from .validate import ParsedResponse


def last_batch_hash(db: Engine, source: str) -> str | None:
    with db.connect() as conn:
        return conn.execute(
            select(raw_observations.c.batch_hash).where(raw_observations.c.source == source)
            .order_by(raw_observations.c.fetched_at.desc(), raw_observations.c.run_id.desc()).limit(1)
        ).scalar()


def archive_and_load(db: Engine, archive: RawArchive, adapter: Adapter, run_id: str,
                     responses: list[ParsedResponse]) -> tuple[str, int]:
    """Archive payloads, chain the batch hash, insert rows. Returns (batch_hash, observations)."""
    if not responses:
        return "", 0
    prev = last_batch_hash(db, adapter.source_id)
    hashes = [sha256_hex(r.raw.body) for r in responses]
    this_batch = batch_hash(prev, hashes)

    raw_rows, obs_rows, comp_rows = [], [], []
    for resp, digest in zip(responses, hashes):
        q = resp.raw.request.query
        key = f"{q.search_date}/{adapter.source_id}/{run_id}/{resp.raw_id}.json.gz"
        object_url = archive.put(key, resp.raw.body)
        raw_rows.append({
            "raw_id": resp.raw_id, "run_id": run_id, "source": adapter.source_id, "object_key": object_url,
            "sha256": digest, "batch_hash": this_batch, "prev_batch_hash": prev,
            "adapter_version": adapter.adapter_version, "fetch_tier": adapter.fetch_tier,
            "fetched_at": resp.raw.fetched_at,
        })
        for row in resp.rows:
            obs_rows.append(row.observation)
            if row.components:
                comp_rows.append(row.components)

    with db.begin() as conn:
        conn.execute(insert(raw_observations), raw_rows)
        if obs_rows:
            conn.execute(insert(fare_observations), obs_rows)
        if comp_rows:
            conn.execute(insert(fare_components), comp_rows)
    return this_batch, len(obs_rows)
