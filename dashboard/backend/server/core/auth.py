"""
Analyst access control (TRD Part H §1, decision D4).

Every analyst request must carry a Firebase ID token (`Authorization: Bearer <token>`)
whose `role` custom claim is ANALYST or ADMIN. Verification happens here, server-side;
hiding pages in the dashboard is not a security control.

Local preview: with ENV=development and AUTH_DEV_ROLE set, a request with no token is
treated as that role (mirrors NEXT_PUBLIC_AUTH_DEV_ROLE in the dashboard). This is
refused at startup in production, see `check_auth_config`.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, Request

from .config import Settings, get_settings
from .errors import ApiError

log = logging.getLogger("aerofarex.auth")

ANALYST_ROLES = frozenset({"ANALYST", "ADMIN"})


@dataclass(frozen=True)
class Principal:
    uid: str
    email: str | None
    role: str
    dev_preview: bool = False


def check_auth_config(settings: Settings) -> None:
    if settings.auth_dev_role and settings.env == "production":
        raise RuntimeError("AUTH_DEV_ROLE must be empty in production: it bypasses sign-in.")
    if settings.auth_dev_role:
        log.warning("AUTH_DEV_ROLE=%s: requests without a token act as %s (local preview only).",
                    settings.auth_dev_role, settings.auth_dev_role)
    elif not settings.firebase_project_id:
        log.warning("FIREBASE_PROJECT_ID is empty: every analyst request will be rejected.")


def _firebase_verifier(project_id: str) -> Callable[[str], dict]:
    import firebase_admin
    from firebase_admin import auth as fb_auth

    try:
        app = firebase_admin.get_app("aerofarex-auth")
    except ValueError:
        # Verifying ID tokens needs only the project id (Google's public certs), no key.
        app = firebase_admin.initialize_app(options={"projectId": project_id}, name="aerofarex-auth")
    return lambda token: fb_auth.verify_id_token(token, app=app, check_revoked=False)


_verifier: Callable[[str], dict] | None = None


def set_token_verifier(verifier: Callable[[str], dict] | None) -> None:
    """Tests inject a fake verifier; production lazily builds the Firebase one."""
    global _verifier
    _verifier = verifier


def _verify(token: str, settings: Settings) -> dict:
    global _verifier
    if _verifier is None:
        if not settings.firebase_project_id:
            raise ApiError(401, "AUTH_NOT_CONFIGURED", "Sign-in isn't configured on this server.")
        _verifier = _firebase_verifier(settings.firebase_project_id)
    try:
        return _verifier(token)
    except ApiError:
        raise
    except Exception as exc:  # expired, malformed, wrong project, bad signature...
        log.info("rejected token: %s", type(exc).__name__)
        raise ApiError(401, "INVALID_TOKEN", "Your session has expired or is invalid. Sign in again.") from exc


def require_analyst(request: Request, settings: Settings = Depends(get_settings)) -> Principal:
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""

    if not token:
        if settings.auth_dev_role and settings.env != "production":
            return Principal(uid="dev-preview", email=None, role=settings.auth_dev_role, dev_preview=True)
        raise ApiError(401, "AUTH_REQUIRED", "Sign in with an analyst account to use this API.")

    claims = _verify(token, settings)
    role = claims.get("role")
    if role not in ANALYST_ROLES:
        raise ApiError(403, "ACCESS_PENDING", "Your account doesn't have analyst access yet.")
    return Principal(uid=claims.get("uid") or claims.get("sub", ""), email=claims.get("email"), role=role)
