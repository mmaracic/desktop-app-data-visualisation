from pydantic import Field
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)


class EnvironmentConfig(BaseSettings):
    """
    EnvironmentConfig is a class that holds the configuration settings for the application.
    It inherits from BaseSettings, which allows it to read environment variables and provide
    default values for the settings.
    """

    # Define your configuration settings here

    azure_cosmos_connection_string: str = Field(init=False)
    azure_cosmos_database_name: str = Field(init=False)

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return env_settings, dotenv_settings, init_settings
