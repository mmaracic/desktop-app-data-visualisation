"""Background BLE collection of camera frames from the custom camera sensor.

Runs a long-lived asyncio task per device address that subscribes to the row
characteristic and keeps reassembling frames for as long as it's running (there is
no timeout); callers start/stop it explicitly and poll it for the latest frame.
"""

import asyncio
import logging

from bleak import BleakClient
from bleak.exc import BleakDBusError, BleakError

from src.api.camera import (
    CAMERA_ROW_CHARACTERISTIC_UUID,
    CameraFrameAssembler,
    CameraFrameError,
    parse_camera_row_chunk,
)

logger = logging.getLogger(__name__)


class CameraFrameStreamer:
    """Continuously collects camera-row chunks from a BLE device in a background task.

    A new `CameraFrameAssembler` is started every time the row counter wraps back to
    0, and each assembler (whether complete or still partially filled) is appended to
    a cache list as soon as it's created. Callers fetch the most recent assembler via
    `get_latest_frame`: a complete frame is popped off the cache and returned, while an
    incomplete one is left in the cache, still being filled in place by the background
    task, so subsequent calls can observe it either finish or eventually get superseded.
    """

    def __init__(
        self, address: str, num_rows: int, num_cols: int, bytes_per_pixel: int
    ) -> None:
        self.address = address
        self.num_rows = num_rows
        self.num_cols = num_cols
        self.bytes_per_pixel = bytes_per_pixel
        self._cache: list[CameraFrameAssembler] = []
        self._task: asyncio.Task | None = None

    def _start_new_assembler(self) -> CameraFrameAssembler:
        assembler = CameraFrameAssembler(
            num_rows=self.num_rows,
            num_cols=self.num_cols,
            bytes_per_pixel=self.bytes_per_pixel,
        )
        self._cache.append(assembler)
        return assembler

    async def start(self) -> None:
        """Start the background BLE notification loop, if not already running."""
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        """Cancel the background BLE notification loop, if running."""
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _run(self) -> None:
        current = self._start_new_assembler()
        last_row = -1

        def _on_notify(_characteristic, payload: bytearray) -> None:
            nonlocal current, last_row
            chunk = parse_camera_row_chunk(bytes(payload))
            logger.info(
                "Received camera row chunk: start_row=%d, start_col=%d, bytes_per_pixel=%d, total_row_bytes=%d, data_length=%d",
                chunk.start_row,
                chunk.start_col,
                chunk.bytes_per_pixel,
                chunk.total_row_bytes,
                len(chunk.data),
            )
            if chunk.start_row == 0 and last_row > 0:
                logger.info(
                    "Row counter wrapped from %d to 0, starting new assembler",
                    last_row,
                )
                current = self._start_new_assembler()
            try:
                current.add_chunk(chunk)
            except CameraFrameError as e:
                logger.warning(f"Discarding malformed camera row chunk: {e}")
            last_row = chunk.start_row

        try:
            async with BleakClient(
                address_or_ble_device=self.address, pair=False
            ) as client:
                await client.start_notify(CAMERA_ROW_CHARACTERISTIC_UUID, _on_notify)
                try:
                    while True:
                        await asyncio.sleep(0.05)
                finally:
                    await client.stop_notify(CAMERA_ROW_CHARACTERISTIC_UUID)
                    await client.disconnect()
                    logger.info(f"Camera streamer for {self.address} stopped")
        except asyncio.CancelledError:
            raise
        except (BleakDBusError, BleakError) as e:
            logger.error(f"Camera streamer for {self.address} disconnected: {e}")

    def get_latest_frame(self) -> CameraFrameAssembler | None:
        """Return the most recently started assembler, removing it if it's complete."""
        if not self._cache:
            return None
        latest = self._cache[-1]
        if latest.is_frame_complete():
            self._cache.pop()
        return latest
