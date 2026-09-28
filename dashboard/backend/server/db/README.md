# server/db

`session.py`: the SQLAlchemy engine for SQLite, applying `journal_mode=WAL`, `foreign_keys=ON`
and `busy_timeout=5000` on every connection (TRD Part E). `DATABASE_URL` can later point at
Postgres; the SQL migrations would then need a Postgres dialect.

`migrate.py`: applies `infra/db/migrations/NNNN_*.sql` in order, each once, each in one
transaction, recorded in `schema_migrations`. Runs at service start and before every command.
