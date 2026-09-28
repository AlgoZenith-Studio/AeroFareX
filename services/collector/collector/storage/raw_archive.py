"""
Raw payload archive (TRD Part A): every response is kept exactly as received, so any
published number can be traced back to bytes and re-parsed after a parser fix.

  sha256       SHA-256 of the raw (uncompressed) response body
  batch hash   SHA-256(prev_batch_hash || sha256_1 || ... || sha256_n) per source per run,
               chaining each run to the previous one: editing or dropping an archived
               payload breaks every later link

Append-only: the local store opens files with "x" (never overwrites); Firebase Storage
uploads use `if_generation_match=0`, so the bucket itself refuses a second write.
"""
from __future__ import annotations

import gzip
import hashlib
from abc import ABC, abstractmethod
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import url2pathname


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def batch_hash(prev_batch_hash: str | None, payload_hashes: list[str]) -> str:
    h = hashlib.sha256((prev_batch_hash or "").encode())
    for p in payload_hashes:
        h.update(p.encode())
    return h.hexdigest()


class ArchiveConflict(Exception):
    """An object already exists at this key; raw payloads are never overwritten."""


class RawArchive(ABC):
    @abstractmethod
    def put(self, key: str, payload: bytes) -> str:
        """Store gzip(payload) at `key`; return the object URL."""

    @abstractmethod
    def get(self, object_url: str) -> bytes:
        """The original (decompressed) payload."""


class LocalArchive(RawArchive):
    def __init__(self, root: Path) -> None:
        self.root = root

    def put(self, key: str, payload: bytes) -> str:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(path, "xb") as f:
                f.write(gzip.compress(payload, mtime=0))
        except FileExistsError as exc:
            raise ArchiveConflict(key) from exc
        return path.resolve().as_uri()

    def get(self, object_url: str) -> bytes:
        return gzip.decompress(Path(url2pathname(urlparse(object_url).path)).read_bytes())


class FirebaseArchive(RawArchive):
    """gs://<bucket>/<key> via the Firebase Admin SDK (service-account key required)."""

    def __init__(self, bucket_name: str) -> None:
        import firebase_admin
        from firebase_admin import storage

        try:
            app = firebase_admin.get_app("aerofarex-archive")
        except ValueError:
            app = firebase_admin.initialize_app(name="aerofarex-archive")
        self.bucket = storage.bucket(bucket_name, app=app)
        self.bucket_name = bucket_name

    def put(self, key: str, payload: bytes) -> str:
        from google.api_core.exceptions import PreconditionFailed

        blob = self.bucket.blob(key)
        blob.content_encoding = "gzip"
        try:
            blob.upload_from_string(gzip.compress(payload, mtime=0), content_type="application/octet-stream",
                                    if_generation_match=0)
        except PreconditionFailed as exc:
            raise ArchiveConflict(key) from exc
        return f"gs://{self.bucket_name}/{key}"

    def get(self, object_url: str) -> bytes:
        key = object_url.split(f"gs://{self.bucket_name}/", 1)[1]
        return gzip.decompress(self.bucket.blob(key).download_as_bytes(raw_download=True))


def open_archive(url: str) -> RawArchive:
    """file:///path/to/dir (local, dev) or gs://bucket (production)."""
    parsed = urlparse(url)
    if parsed.scheme == "file":
        return LocalArchive(Path(url2pathname(parsed.path)))
    if parsed.scheme == "gs":
        return FirebaseArchive(parsed.netloc)
    raise ValueError(f"unsupported RAW_ARCHIVE_URL {url!r} (use file:///... or gs://bucket)")
