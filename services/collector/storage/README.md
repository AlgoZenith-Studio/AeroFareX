# storage

Raw payload persistence: SHA-256 hashing, chained batch hashes (batch_hash / prev_batch_hash),
and upload to Firebase Cloud Storage (gs://airfare-raw-observations/...). Append-only: no
update or delete path exists for raw artifacts.
