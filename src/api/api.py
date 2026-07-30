"This module defines the API routes for the FastAPI application." ""
from datetime import datetime

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/items")
def get_items_between(
    request: Request,
    start: datetime,
    end: datetime,
    container_name: str,
) -> list[dict]:
    """Return items whose timestamp falls between start and end (both inclusive)."""
    repo = request.app.state.azure_repository
    return repo.read_items_between(start=start, end=end, container_name=container_name)
