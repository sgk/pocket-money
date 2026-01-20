from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes_assets import router as assets_router
from app.api.routes_bootstrap import router as bootstrap_router
from app.api.routes_categories import router as categories_router
from app.api.routes_summary import router as summary_router
from app.api.routes_transactions import router as transactions_router
from app.core.config import get_settings
from app.core.errors import (
    AppError,
    json_error_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)


app = FastAPI(title="Pocket Money API", version="0.1.0")

WEB_DIR = Path(__file__).parent / "web"


@app.get("/healthz")
def healthz():
    return "ok"


@app.get("/api/config")
def get_config():
    settings = get_settings()
    return {"googleClientId": settings.google_client_id}


@app.get("/")
def index():
    return FileResponse(WEB_DIR / "index.html")


app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


app.include_router(bootstrap_router)
app.include_router(assets_router)
app.include_router(categories_router)
app.include_router(transactions_router)
app.include_router(summary_router)

app.add_exception_handler(AppError, json_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

try:
    from fastapi.exceptions import RequestValidationError

    app.add_exception_handler(RequestValidationError, validation_exception_handler)
except Exception:
    pass
