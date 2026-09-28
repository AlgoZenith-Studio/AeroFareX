"""
Live source health for the dashboard's Source health page: written to Firestore
`sources/{source_id}` (read by analysts per infra/firebase/firestore.rules) when a
service-account key is available, otherwise only kept in SQLite (source_health).
A failed push is logged and never fails the collection run.
"""
from __future__ import annotations

import logging
import os

log = logging.getLogger("aerofarex.collector.health")


def push_source_health(rows: list[dict], project_id: str) -> bool:
    if not (project_id and os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")):
        log.debug("Firestore health push skipped (no service-account key)")
        return False
    try:
        import firebase_admin
        from firebase_admin import firestore

        try:
            app = firebase_admin.get_app("aerofarex-health")
        except ValueError:
            app = firebase_admin.initialize_app(options={"projectId": project_id}, name="aerofarex-health")
        db = firestore.client(app)
        batch = db.batch()
        for row in rows:
            batch.set(db.collection("sources").document(row["source_id"]), row, merge=True)
        batch.commit()
        return True
    except Exception:
        log.exception("Firestore health push failed")
        return False
