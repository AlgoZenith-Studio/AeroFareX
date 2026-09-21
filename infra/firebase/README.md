# infra/firebase

firebase.json, firestore.rules, storage.rules. Firestore holds live source health/circuit-breaker
state and surge alerts (read-only for VIEWER+, write restricted to the collector service account).
Storage rules enforce append-only semantics on gs://airfare-raw-observations.
