"""This module defines the API routes for the FastAPI application."""

import logging
from datetime import datetime

from bleak import BleakClient, BleakScanner
from bleak.exc import BleakDBusError, BleakError
from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)

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


async def _read_characteristic_value(client: BleakClient, characteristic) -> str | None:
    """Read a characteristic's value, returning it as a hex string, or None if it can't be read."""
    if "read" not in characteristic.properties:
        return None
    try:
        raw = await client.read_gatt_char(characteristic)
    except (BleakDBusError, BleakError) as e:
        logger.warning(f"Failed to read characteristic {characteristic.uuid}: {e}")
        return None
    return raw.hex()


@router.get("/bluetooth/device/{address}")
async def get_ble_device(request: Request, address: str) -> dict:
    """Connect to a specific BLE device by address."""
    logger.info(f"Connecting to BLE device at address: {address}")
    try:
        client = BleakClient(address_or_ble_device=address, pair=False)
        await client.connect()
        return {
            "name": getattr(client, "name", None),
            "address": client.address,
            "services": [
                {
                    "uuid": service.uuid,
                    "description": service.description,
                    "characteristics": [
                        {
                            "uuid": characteristic.uuid,
                            "description": characteristic.description,
                            "properties": characteristic.properties,
                            "value": await _read_characteristic_value(
                                client, characteristic
                            ),
                        }
                        for characteristic in service.characteristics
                    ],
                }
                for service in client.services
            ],
        }
    except (BleakDBusError, BleakError) as e:
        logger.error(f"Failed to connect to BLE device at address {address}: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Bluetooth device is unavailable: {e}",
        ) from e
    finally:
        await client.disconnect()
