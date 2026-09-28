# server/core

`config.py` (all settings, from env / `.env.local`), `auth.py` (Firebase ID-token verification
and the ANALYST/ADMIN role check on every analyst request; `AUTH_DEV_ROLE` local preview,
refused in production), `errors.py` (the `{error, code, message, correlation_id}` envelope and
the `x-correlation-id` header).
