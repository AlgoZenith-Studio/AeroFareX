# infra/db

SQLite 3 schema for `aerofarex-core` (TRD Part E, decision D1): WAL mode, `STRICT` tables,
integer paise, ISO-8601 UTC timestamps, and append-only triggers so raw data, observations,
published snapshots and the audit log can't be edited or deleted, even by a bug.

`migrations/` holds ordered `NNNN_description.sql` files. `aerofarex migrate` (in
`dashboard/backend/server/db/migrate.py`) applies any file not yet listed in the
`schema_migrations` table, each in its own transaction. Never edit an applied migration;
add a new file.

| File | What |
| :--- | :--- |
| `0001_init.sql` | All tables, indexes and append-only triggers |
| `0002_reference_data.sql` | The basket: 5 routes + DGCA pax shares, 4 carriers, 5 sources |

`DATABASE_URL` defaults to `sqlite:///./data/aerofarex.db` locally and
`sqlite:////data/aerofarex.db` on Railway (volume at `/data`).
