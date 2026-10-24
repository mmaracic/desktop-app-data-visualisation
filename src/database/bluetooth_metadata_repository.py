"""Persists Bluetooth device metadata to a local JSON file.

The JSON file contains a list of metadata objects, one per known device address.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from threading import Lock

from pydantic import ValidationError

from src.model.bluetooth_metadata import BluetoothDeviceMetadata

logger = logging.getLogger(__name__)


class BluetoothMetadataRepository:
    """Stores Bluetooth device metadata in a local JSON file, keyed by device address.

    Args:
        file_path (str | Path): Path of the JSON file used for persistence.

    """

    def __init__(self, file_path: str | Path = "bluetooth_metadata.json") -> None:
        self.file_path = Path(file_path)
        self._lock = Lock()

    def load_all(self) -> list[BluetoothDeviceMetadata]:
        """Return all stored metadata entries.

        Returns an empty list if the file does not exist yet or cannot be parsed.
        """
        with self._lock:
            return self._read_file()

    def upsert(self, metadata: BluetoothDeviceMetadata) -> BluetoothDeviceMetadata:
        """Insert or update the metadata entry for a device address and persist it to disk.

        Args:
            metadata (BluetoothDeviceMetadata): The metadata to store.

        Returns:
            BluetoothDeviceMetadata: The stored entry with a fresh ``updated_at`` timestamp.

        """
        with self._lock:
            entries = self._read_file()
            updated = metadata.model_copy(update={"updated_at": datetime.now()})
            for i, existing in enumerate(entries):
                if existing.address == metadata.address:
                    entries[i] = updated
                    break
            else:
                entries.append(updated)
            self._write_file(entries)
            return updated

    def _read_file(self) -> list[BluetoothDeviceMetadata]:
        """Read and validate all entries from the JSON file (caller must hold ``_lock``)."""
        if not self.file_path.exists():
            return []
        try:
            raw = json.loads(self.file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(
                f"Could not read Bluetooth metadata file {self.file_path}: {e}"
            )
            return []
        entries: list[BluetoothDeviceMetadata] = []
        for item in raw if isinstance(raw, list) else []:
            try:
                entries.append(BluetoothDeviceMetadata.model_validate(item))
            except ValidationError as e:
                logger.warning(f"Skipping invalid Bluetooth metadata entry {item}: {e}")
        return entries

    def _write_file(self, entries: list[BluetoothDeviceMetadata]) -> None:
        """Write all entries to the JSON file (caller must hold ``_lock``)."""
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(
            [entry.model_dump(mode="json") for entry in entries],
            indent=2,
            ensure_ascii=False,
        )
        self.file_path.write_text(payload + "\n", encoding="utf-8")
