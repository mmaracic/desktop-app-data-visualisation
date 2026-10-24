"""Pydantic models for Bluetooth device metadata."""

from datetime import datetime

from pydantic import BaseModel, Field


class BluetoothDeviceMetadata(BaseModel):
    """Metadata about a Bluetooth device the user has seen before.

    Attributes:
        address: The BLE address of the device (unique key).
        name: Last known advertised name of the device.
        note: Free-form note written by the user.
        updated_at: When this metadata entry was last saved.

    """

    address: str
    name: str | None = None
    note: str = ""
    updated_at: datetime = Field(default_factory=datetime.now)


class BluetoothDeviceMetadataUpdate(BaseModel):
    """Payload for saving/updating a device's metadata (address comes from the URL)."""

    name: str | None = None
    note: str = ""
