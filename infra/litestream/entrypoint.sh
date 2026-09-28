#!/bin/sh
# Container entrypoint for aerofarex-core.
#  1. Railway variables are strings: a service-account key given as JSON text in
#     GOOGLE_APPLICATION_CREDENTIALS_JSON is written to a private file.
#  2. With LITESTREAM_GCS_BUCKET set, restore the database if the volume is empty, then
#     run the API under `litestream replicate` (continuous backup to Firebase Storage).
set -e

if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
  umask 077
  printf '%s' "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/gcp-service-account.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-service-account.json
fi

mkdir -p /data
APP="aerofarex serve --host 0.0.0.0 --port ${PORT:-8000}"

if [ -n "$LITESTREAM_GCS_BUCKET" ]; then
  litestream restore -config infra/litestream/litestream.yml -if-db-not-exists -if-replica-exists /data/aerofarex.db
  exec litestream replicate -config infra/litestream/litestream.yml -exec "$APP"
fi

exec $APP
