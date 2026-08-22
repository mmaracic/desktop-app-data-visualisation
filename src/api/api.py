"""This module defines the API routes for the FastAPI application."""

import base64
import io
import logging
from datetime import datetime

from bleak import BleakClient, BleakScanner
from bleak.exc import BleakDBusError, BleakError
from fastapi import APIRouter, HTTPException, Request

from src.api.camera import CameraFrameError
from src.api.camera_streamer import CameraFrameStreamer

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


@router.post("/bluetooth/camera/{address}/start")
async def start_collecting_camera_frames(
    request: Request,
    address: str,
    num_rows: int,
    num_cols: int,
    bytes_per_pixel: int,
) -> dict:
    """Start the background BLE task collecting camera frames for `address` and return immediately."""
    streamer: CameraFrameStreamer | None = request.app.state.camera_streamer
    if streamer is not None and (
        streamer.address != address
        or streamer.num_rows != num_rows
        or streamer.num_cols != num_cols
        or streamer.bytes_per_pixel != bytes_per_pixel
    ):
        await streamer.stop()
        streamer = None
    if streamer is None:
        streamer = CameraFrameStreamer(
            address=address,
            num_rows=num_rows,
            num_cols=num_cols,
            bytes_per_pixel=bytes_per_pixel,
        )
        request.app.state.camera_streamer = streamer
        try:
            await streamer.start()
        except (BleakDBusError, BleakError) as e:
            request.app.state.camera_streamer = None
            logger.error(f"Failed to start camera stream for {address}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Bluetooth device is unavailable: {e}",
            ) from e
    return {"status": "collecting"}


@router.post("/bluetooth/camera/{address}/stop")
async def stop_collecting_camera_frames(request: Request, address: str) -> dict:
    """Stop the background BLE task collecting camera frames for `address`, if running."""
    streamer: CameraFrameStreamer | None = request.app.state.camera_streamer
    if streamer is not None and streamer.address == address:
        await streamer.stop()
        request.app.state.camera_streamer = None
    return {"status": "stopped"}


@router.get("/bluetooth/camera/{address}/frame")
async def get_camera_frame(request: Request, address: str) -> dict:
    """Return the latest camera frame collected in the background for `address`, as base64 PNGs."""
    streamer: CameraFrameStreamer | None = request.app.state.camera_streamer
    if streamer is None or streamer.address != address:
        raise HTTPException(
            status_code=404,
            detail=f"No camera frame collection is running for {address}",
        )

    assembler = streamer.get_latest_frame()
    if assembler is None:
        raise HTTPException(
            status_code=404,
            detail=f"No camera frame collected yet for {address}",
        )

    try:
        image, mask_image = assembler.to_image(), assembler.mask_to_image()
    except CameraFrameError as e:
        logger.error(f"Malformed camera row chunk from {address}: {e}")
        raise HTTPException(status_code=422, detail=str(e)) from e

    def _to_base64_png(img) -> str:
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")

    return {
        "image": _to_base64_png(image),
        "mask_image": _to_base64_png(mask_image),
        "timestamp": assembler.completed_at_or_now().isoformat(),
    }
