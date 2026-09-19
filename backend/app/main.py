"""GoalNexa FastAPI application entrypoint.

Registers exactly two global exception handlers so every error response —
whether raised as `HTTPException` from a dependency/shared helper, or a
Pydantic `RequestValidationError` — comes back in the flat
`{code, message, field_errors}` shape. Hand-rolled business-rule rejections
in route bodies (auth.py, org_memberships.py) build that same shape directly
via `JSONResponse` and never touch this machinery.
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    auth,
    goals,
    org_memberships,
    organizations,
    role_assignments,
)
from app.core.config import settings

app = FastAPI(title="GoalNexa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Unwrap `exc.detail` when it's already `{code, message, ...}`-shaped
    (every `raise HTTPException(..., detail={...})` in this codebase uses
    that shape); fall back to a generic body otherwise (e.g. a `detail` FastAPI
    itself might raise as a plain string).
    """
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        content = {
            "code": detail["code"],
            "message": detail["message"],
            "field_errors": detail.get("field_errors"),
        }
    else:
        content = {"code": "http_error", "message": str(detail), "field_errors": None}
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Map Pydantic's `errors()` into `field_errors: {field_path: [messages]}`."""
    field_errors: dict[str, list[str]] = {}
    for error in exc.errors():
        loc = error.get("loc", ())
        # loc is typically ("body"|"query"|"path", "field", ...) — drop the
        # first segment (the request part) to get a clean dotted field path.
        if len(loc) > 1:
            field_path = ".".join(str(part) for part in loc[1:])
        else:
            field_path = str(loc[0]) if loc else "__root__"
        field_errors.setdefault(field_path, []).append(error.get("msg", "Invalid value."))

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "validation_error",
            "message": "Request failed validation.",
            "field_errors": field_errors,
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(org_memberships.router)
app.include_router(role_assignments.router)
app.include_router(goals.router)
