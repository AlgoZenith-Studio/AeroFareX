"""The standard error envelope (TRD Part D): { error, code, message, correlation_id }."""
from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("aerofarex")

CORRELATION_HEADER = "x-correlation-id"


class ApiError(Exception):
    """Raise from any route to return a typed error with a stable machine code."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def correlation_id(request: Request) -> str:
    return getattr(request.state, "correlation_id", None) or uuid.uuid4().hex[:16]


def _body(request: Request, status: int, code: str, message: str) -> JSONResponse:
    cid = correlation_id(request)
    reason = {400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
              422: "Unprocessable Entity", 429: "Too Many Requests"}.get(status, "Request failed")
    if status >= 500:
        reason = "Internal Server Error"
    return JSONResponse(
        status_code=status,
        content={"error": reason, "code": code, "message": message, "correlation_id": cid},
        headers={CORRELATION_HEADER: cid},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def _correlation(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.correlation_id = request.headers.get(CORRELATION_HEADER) or uuid.uuid4().hex[:16]
        response = await call_next(request)
        response.headers[CORRELATION_HEADER] = request.state.correlation_id
        return response

    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        return _body(request, exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", []) if p not in ("query", "path"))
        return _body(request, 422, "INVALID_PARAMETER", f"{where}: {first.get('msg', 'invalid value')}")

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else f"HTTP_{exc.status_code}"
        return _body(request, exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error [%s]", correlation_id(request))
        return _body(request, 500, "INTERNAL", "Something went wrong. Quote the correlation id when reporting it.")
