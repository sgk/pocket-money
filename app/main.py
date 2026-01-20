from fastapi import FastAPI

from app.api.routes_assets import router as assets_router
from app.api.routes_bootstrap import router as bootstrap_router
from app.api.routes_categories import router as categories_router
from app.api.routes_summary import router as summary_router
from app.api.routes_transactions import router as transactions_router
from app.core.errors import (
    AppError,
    json_error_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)


app = FastAPI(title="Pocket Money API", version="0.1.0")


@app.get("/healthz")
def healthz():
    return "ok"


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
