"""Parsing and frame reassembly for the custom BLE camera sensor.

The camera device exposes a single "row" characteristic that notifies chunks of
pixel data. Each notification is prefixed with a `<HHBH` header (start_row,
start_col, bytes_per_pixel, total_row_bytes) followed by a data chunk sized to
fit the negotiated MTU. A chunk may span into the next row; `total_row_bytes`
is used to find the row boundary and continue filling subsequent rows.
"""

import struct
from dataclasses import dataclass
from datetime import UTC, datetime

from PIL import Image

_PIL_MODE_BY_BYTES_PER_PIXEL = {1: "L", 3: "RGB", 4: "RGBA"}

CAMERA_SERVICE_UUID = "ba6a8c7b-a79d-4e66-b91e-2fe9f9e962ec"
CAMERA_ROW_CHARACTERISTIC_UUID = "b777e097-d4af-4a7f-a83b-302925b3e63c"

_ROW_HEADER_FORMAT = "<HHBH"
_ROW_HEADER_SIZE = struct.calcsize(_ROW_HEADER_FORMAT)

@dataclass
class CameraRowChunk:
    """A single decoded camera-row notification."""

    start_row: int
    start_col: int
    bytes_per_pixel: int
    total_row_bytes: int
    data: bytes


def parse_camera_row_chunk(payload: bytes) -> CameraRowChunk:
    """Decode a raw camera-row characteristic notification into header fields and data."""
    if len(payload) < _ROW_HEADER_SIZE:
        raise ValueError(f"Camera row payload too short: {len(payload)} bytes")
    start_row, start_col, bytes_per_pixel, total_row_bytes = struct.unpack_from(
        _ROW_HEADER_FORMAT, payload
    )
    return CameraRowChunk(
        start_row=start_row,
        start_col=start_col,
        bytes_per_pixel=bytes_per_pixel,
        total_row_bytes=total_row_bytes,
        data=payload[_ROW_HEADER_SIZE:],
    )


class CameraFrameError(ValueError):
    """Raised when a camera row chunk is inconsistent with the expected frame layout."""


class CameraFrameAssembler:
    """Reassembles camera-row chunks into a pre-sized frame of known dimensions.

    The frame layout (rows, columns, bytes per pixel) must be known upfront; any chunk
    that disagrees with it, falls outside the frame, or overlaps already-filled bytes
    raises `CameraFrameError`. `completed_at` is recorded the moment every row becomes
    filled, so callers can tell when a fetched frame actually finished collecting.
    """

    def __init__(self, num_rows: int, num_cols: int, bytes_per_pixel: int) -> None:
        self.num_rows = num_rows
        self.num_cols = num_cols
        self.bytes_per_pixel = bytes_per_pixel
        self.total_row_bytes = num_cols * bytes_per_pixel
        self._row_buffers = [bytearray(self.total_row_bytes) for _ in range(num_rows)]
        # Per-byte received mask (0/1), separate from data so real black pixels (0x00)
        # aren't mistaken for bytes that never arrived.
        self._row_filled = [bytearray(self.total_row_bytes) for _ in range(num_rows)]
        self.completed_at: datetime | None = None

    def add_chunk(self, chunk: CameraRowChunk) -> None:
        """Write a chunk's data into the row buffer(s) it belongs to, spilling into next rows."""
        if chunk.total_row_bytes != self.total_row_bytes:
            raise CameraFrameError(
                f"Chunk total_row_bytes {chunk.total_row_bytes} does not match "
                f"expected {self.total_row_bytes}"
            )
        if chunk.bytes_per_pixel != self.bytes_per_pixel:
            raise CameraFrameError(
                f"Chunk bytes_per_pixel {chunk.bytes_per_pixel} does not match "
                f"expected {self.bytes_per_pixel}"
            )
        row = chunk.start_row
        offset = chunk.start_col
        remaining = chunk.data
        while remaining:
            if not 0 <= row < self.num_rows:
                raise CameraFrameError(
                    f"Chunk spills into row {row}, outside expected range [0, {self.num_rows})"
                )
            space_in_row = self.total_row_bytes - offset
            piece, remaining = remaining[:space_in_row], remaining[space_in_row:]
            end = offset + len(piece)
            # Overlapping writes are tolerated (last write wins); rows start black
            # so any bytes never received simply stay black instead of failing.
            self._row_buffers[row][offset:end] = piece
            self._row_filled[row][offset:end] = b"\x01" * len(piece)
            # remaining is only non-empty when piece exactly reached total_row_bytes,
            # so the next row always starts at column 0; equivalent to `end % total_row_bytes`.
            offset = 0
            row += 1
        if self.completed_at is None and self.is_frame_complete():
            self.completed_at = datetime.now(UTC)

    def is_row_complete(self, row: int) -> bool:
        return all(self._row_filled[row])

    def is_frame_complete(self) -> bool:
        return all(self.is_row_complete(row) for row in range(self.num_rows))

    def completed_at_or_now(self) -> datetime:
        """Return when the frame was completed, or the current time if still in progress."""
        return self.completed_at if self.completed_at is not None else datetime.now(UTC)

    def rows(self) -> list[bytes]:
        """Return the full frame's rows, including black placeholders for missing bytes."""
        return [bytes(buf) for buf in self._row_buffers]

    def filled_mask(self) -> list[bytes]:
        """Return a per-row byte mask (1 = received, 0 = still a black placeholder)."""
        return [bytes(mask) for mask in self._row_filled]

    def to_image(self) -> Image.Image:
        """Render the frame as a PIL image; missing bytes appear black."""
        mode = _PIL_MODE_BY_BYTES_PER_PIXEL.get(self.bytes_per_pixel)
        if mode is None:
            raise CameraFrameError(
                f"Unsupported bytes_per_pixel for image rendering: {self.bytes_per_pixel}"
            )
        return Image.frombytes(
            mode, (self.num_cols, self.num_rows), b"".join(self._row_buffers)
        )

    def mask_to_image(self) -> Image.Image:
        """Render the received-byte mask as a single-channel image (white = received)."""
        mask_pixels = bytes(
            (
                255
                if any(
                    mask[col * self.bytes_per_pixel : (col + 1) * self.bytes_per_pixel]
                )
                else 0
            )
            for mask in self._row_filled
            for col in range(self.num_cols)
        )
        return Image.frombytes("L", (self.num_cols, self.num_rows), mask_pixels)
