"""This module defines the API routes for the FastAPI application."""

from datetime import datetime

from bleak import BleakScanner
from bleak.exc import BleakDBusError, BleakError
from fastapi import APIRouter, HTTPException, Request

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


@router.get("/bluetooth/ble_list")
async def get_ble_list(request: Request) -> list[dict]:
    """Return a list of BLE devices."""
    try:
        devices = await BleakScanner.discover()
    except (BleakDBusError, BleakError) as e:
        raise HTTPException(
            status_code=503,
            detail=f"Bluetooth adapter is unavailable: {e}",
        ) from e
    return [
        {
            "address": device.address,
            "name": device.name,
            "details": str(device.details),
        }
        for device in devices
    ]
