"""Desktop application entry point combining FastAPI, uvicorn, and pywebview."""

import argparse
import logging
import threading

import fastapi
import uvicorn
import webview
from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.api import api
from src.colored_log_formatter import ColoredLogFormatter
from src.config.environment_config import EnvironmentConfig
from src.database.azure_repository import AzureRepository
from src.dev_proxy import _dev_proxy

log_handler = logging.StreamHandler()
log_handler.setFormatter(
    ColoredLogFormatter(
        fmt="%(asctime)s %(levelname)s %(threadName)s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
)
logging.basicConfig(level=logging.INFO, handlers=[log_handler])
logger = logging.getLogger(__name__)


class Config(BaseModel):
    """Configuration for the application."""

    host: str = "127.0.0.1"
    port: int = 5000
    dev: bool = False


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    """
    Lifespan context manager for the FastAPI application.
    """
    settings = EnvironmentConfig()
    logger.info("Settings: %s", settings)
    app.state.azure_repository = AzureRepository(
        connection_string=settings.azure_cosmos_connection_string,
        database_name=settings.azure_cosmos_database_name,
        container_name="your_container_name",  # Replace with your actual container name
    )
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(api.router, prefix="/api")


def _run_backend_server(config: Config) -> None:
    """Start the uvicorn server in a background thread."""
    uvicorn_config = uvicorn.Config(
        app, host=config.host, port=config.port, log_level="info", log_config=None
    )
    server = uvicorn.Server(uvicorn_config)
    server.run()


def parse_args() -> Config:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Agentic desktop application")
    parser.add_argument(
        "--host", type=str, default="127.0.0.1", help="Host for the backend server"
    )
    parser.add_argument(
        "--port", type=int, default=5000, help="Port for the backend server"
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Run in development mode, pointing the webview at the Vite dev server",
    )
    args = parser.parse_args()
    return Config(host=args.host, port=args.port, dev=args.dev)


def main() -> None:
    """Main entry point for the application."""
    config = parse_args()

    if not config.dev:
        app.mount("/", StaticFiles(directory="react/dist", html=True))
    else:
        app.add_api_route("/", _dev_proxy, methods=["GET", "HEAD", "OPTIONS"])
        app.add_api_route(
            "/{path:path}", _dev_proxy, methods=["GET", "HEAD", "OPTIONS"]
        )

    # Python application shuts down when only daemon threads are running.
    # Running the backend server in a daemon thread rather than in webview start method
    # allows the application to exit gracefully when the webview window is closed.
    thread = threading.Thread(target=_run_backend_server, args=(config,), daemon=True)
    thread.start()

    server = f"http://{config.host}:{config.port}"
    logger.info("Backend server starting at %s", server)
    window = webview.create_window("Data visualisation Application", server)
    if window is None:
        logger.error("Failed to create webview window, shutting down backend server...")
        return
    window.events.shown += lambda: logger.info("Webview window is now visible")
    webview.start()
    logger.info("Webview window closed, shutting down backend server...")


if __name__ == "__main__":
    main()
