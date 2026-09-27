# infra/firebase

firebase.json, firestore.rules, storage.rules. Firestore holds live source health/circuit-breaker
state and surge alerts (read-only for analysts, write restricted to the collector service account),
and each public traveller's own search history and saved routes under users/{uid} (owner-only).
Storage rules enforce append-only semantics on gs://aerofarex-raw-observations.
