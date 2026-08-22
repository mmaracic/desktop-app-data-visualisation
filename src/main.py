"""Desktop application entry point combining FastAPI, uvicorn, and pywebview."""

import argparse
import asyncio
import logging
import threading
from threading import Semaphore

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
    app.state.camera_streamer = None
    yield
    logger.info("Shutting down FastAPI application...")
    if app.state.camera_streamer is not None:
        await app.state.camera_streamer.stop()


app = FastAPI(lifespan=lifespan)
app.include_router(api.router, prefix="/api")


async def _run_backend_server(
    config: Config, sem: Semaphore, server_holder: list[uvicorn.Server]
) -> None:
    """Start the uvicorn server in a background thread with a semaphore to block main thread until the server is ready."""
    uvicorn_config = uvicorn.Config(
        app, host=config.host, port=config.port, log_level="info", log_config=None
    )
    server = uvicorn.Server(uvicorn_config)
    server_holder.append(server)
    logger.info("Starting backend server at http://%s:%d", config.host, config.port)
    server_task = asyncio.create_task(server.serve())

    # Wait until Uvicorn explicitly flags that it's ready
    while not server.started:
        await asyncio.sleep(0.1)

    logger.info(
        "Backend server is ready and running at http://%s:%d",
        config.host,
        config.port,
    )
    sem.release()  # Release the semaphore to unblock the main thread

    await server_task


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

    sem = Semaphore(0)  # Semaphore to block main thread until the server is ready
    server_holder: list[uvicorn.Server] = []
    # Python application shuts down when only daemon threads are running.
    # Running the backend server in a daemon thread rather than in webview start method
    # allows the application to exit gracefully when the webview window is closed.
    thread = threading.Thread(
        target=lambda: asyncio.run(_run_backend_server(config, sem, server_holder)),
        daemon=True,
    )
    thread.start()
    sem.acquire()  # Block main thread until the server is ready

    server_url = f"http://{config.host}:{config.port}"
    logger.info("Connecting to backend server at %s", server_url)
    window = webview.create_window("Data visualisation Application", server_url)
    if window is None:
        logger.error("Failed to create webview window, shutting down backend server...")
        return
    window.events.shown += lambda: logger.info("Webview window is now visible")
    webview.start()

    logger.info("Webview window closed, shutting down backend server...")
    # Signal uvicorn to exit gracefully so the FastAPI lifespan shutdown runs.
    backend_server = server_holder[0]
    backend_server.should_exit = True
    thread.join(timeout=10)


if __name__ == "__main__":
    main()
