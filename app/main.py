from pathlib import Path

import json

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes_assets import router as assets_router
from app.api.routes_bootstrap import router as bootstrap_router
from app.api.routes_categories import router as categories_router
from app.api.routes_config import router as config_router
from app.api.routes_summary import router as summary_router
from app.api.routes_transactions import router as transactions_router
from app.core.auth import create_session_token_from_google
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
app.include_router(config_router)
app.include_router(transactions_router)
app.include_router(summary_router)

app.add_exception_handler(AppError, json_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

try:
    from fastapi.exceptions import RequestValidationError

    app.add_exception_handler(RequestValidationError, validation_exception_handler)
except Exception:
    pass

dist_dir = Path(__file__).resolve().parent.parent / "web" / "dist"
index_file = dist_dir / "index.html"


def serve_index():
    return FileResponse(index_file)


@app.get("/")
def spa_root():
    return serve_index()


@app.get("/login")
def spa_login():
    return serve_index()


@app.post("/login")
async def spa_login_post(request: Request):
    form = await request.form()
    credential = form.get("credential")
    csrf_token = form.get("g_csrf_token")
    cookie_token = request.cookies.get("g_csrf_token")
    if not credential or not csrf_token or csrf_token != cookie_token:
        return HTMLResponse("login failed", status_code=400)
    try:
        session_token = create_session_token_from_google(str(credential))
    except AppError:
        return HTMLResponse("login failed", status_code=401)
    token_json = json.dumps(session_token)
    return HTMLResponse(
        f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ログイン</title>
  </head>
  <body>
    <script>
      try {{
        localStorage.setItem("auth.token", {token_json});
        window.location.replace("/");
      }} catch (e) {{
        document.body.textContent = "login failed";
      }}
    </script>
  </body>
</html>"""
    )


@app.get("/ledger")
def spa_ledger():
    return serve_index()


@app.get("/assets")
def spa_assets():
    return serve_index()


@app.get("/assets/{asset_id}/ledger")
def spa_asset_ledger(asset_id: str):
    return serve_index()


@app.get("/settings/assets")
def spa_settings_assets():
    return serve_index()


@app.get("/settings/categories")
def spa_settings_categories():
    return serve_index()


app.mount("/", StaticFiles(directory=dist_dir), name="static")
