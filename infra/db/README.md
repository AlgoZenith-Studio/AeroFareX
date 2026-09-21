# infra/db

PostgreSQL 16 + TimescaleDB. migrations/ holds versioned SQL migration files implementing the
enums and hypertables in TRD Part E (fare_observations, index_snapshots as hypertables;
raw_observations append-only with UPDATE/DELETE revoked).
