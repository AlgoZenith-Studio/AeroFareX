# aerofarex-core: one Railway service (TRD Part H §2). Build from the repo root:
#   docker build -f infra/docker/core.Dockerfile -t aerofarex-core .
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    TZ=Asia/Kolkata

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

# Litestream: continuous SQLite replication to Firebase Storage (a GCS bucket).
ARG LITESTREAM_VERSION=0.3.13
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C /usr/local/bin litestream \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first (cached layer), then the code.
COPY pyproject.toml uv.lock ./
COPY dashboard/backend/pyproject.toml dashboard/backend/
COPY landing/backend/pyproject.toml landing/backend/
COPY services/collector/pyproject.toml services/collector/
RUN uv sync --frozen --all-packages --no-dev --no-install-workspace

COPY dashboard/backend/server dashboard/backend/server
COPY landing/backend/public_api landing/backend/public_api
COPY services/collector/collector services/collector/collector
COPY infra/db/migrations infra/db/migrations
COPY infra/litestream infra/litestream
RUN uv sync --frozen --all-packages --no-dev

ENV PATH="/app/.venv/bin:$PATH" \
    ENV=production \
    DATABASE_URL=sqlite:////data/aerofarex.db \
    RAW_ARCHIVE_URL=file:///data/raw \
    SCHEDULER_ENABLED=true

EXPOSE 8000
CMD ["sh", "infra/litestream/entrypoint.sh"]
