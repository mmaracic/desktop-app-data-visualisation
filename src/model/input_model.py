from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_serializer
from pydantic.types import UUID4


class InputModel(BaseModel):

    id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    container_name: str
    topic_name: str
    creation_date_time: datetime
    data: dict[str, Any]

    @field_serializer("creation_date_time", mode="plain")
    def ser_number(self, value: datetime) -> str:
        return value.isoformat()
