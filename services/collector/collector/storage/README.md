# storage

Raw payload persistence (`raw_archive.py`): every response body is kept exactly as received
(gzip), hashed with SHA-256, and chained per source per run with a batch hash
(`SHA-256(prev_batch_hash || sha256_1 || … || sha256_n)`), recorded in `raw_observations`.

Append-only at every layer: the local store never overwrites a file, Firebase Storage uploads
are create-only (`if_generation_match=0`), and the `raw_observations` table has
no-update/no-delete triggers.

`RAW_ARCHIVE_URL`: `file:///…/data/raw` locally (default), `gs://aerofarex-raw-observations`
in production (needs `GOOGLE_APPLICATION_CREDENTIALS`).
