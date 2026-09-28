"""Analyst API (TRD Part D §2). Every route requires role ANALYST or ADMIN."""
from fastapi import APIRouter, Depends

from ...core.auth import require_analyst
from . import export, health, index, lead_time, methodology, observations, quality, routes

router = APIRouter(dependencies=[Depends(require_analyst)])
for module in (index, routes, observations, lead_time, quality, health, methodology, export):
    router.include_router(module.router)
