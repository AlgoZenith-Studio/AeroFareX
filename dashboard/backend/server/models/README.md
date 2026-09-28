# server/models

SQLAlchemy Core tables mirroring `infra/db/migrations`: routes, route_weights, carriers, sources,
raw_observations, fare_observations, fare_components, ancillary_observations, collection_runs,
source_health, index_snapshots, index_contributions, audit_events. The SQL files own the DDL,
constraints and append-only triggers; these are for queries and inserts.
