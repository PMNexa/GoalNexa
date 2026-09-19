"""The generic CRUD engine.

`make_crud_router(CrudEntityConfig(...))` wires up `GET/POST /{resource}s`
and `GET/PATCH/DELETE /{resource}s/{id}` for any org-scoped SQLAlchemy model
+ Pydantic schema trio, sharing one implementation of pagination, sorting,
searching, filtering, and the 404-before-403 org-access gate
(`app.core.rbac.check_org_access`).

Deliberately does NOT use `from __future__ import annotations` — route
functions below annotate request bodies as `config.create_schema` /
`config.update_schema`, which must be resolved to the actual class object at
function-definition time (a closure lookup) for FastAPI to introspect via
`inspect.signature`; stringified annotations would break that.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import check_org_access, get_current_user, get_db
from app.db.base import Base
from app.models.user import User


def clamp_pagination(page: int, page_size: int, max_page_size: int = 100) -> tuple[int, int]:
    """Clamp `page` to >= 1 and `page_size` to `[1, max_page_size]`."""
    clamped_page = max(1, page)
    clamped_page_size = min(max(1, page_size), max_page_size)
    return clamped_page, clamped_page_size


def parse_sort(sort_param: str | None, allowed_fields: tuple[str, ...]) -> tuple[str, bool] | None:
    """Parse a `sort` query param shaped `field` or `-field`.

    Returns `(field_name, descending)`, or `None` when `sort_param` is empty
    or names a field outside `allowed_fields` — callers should fall back to
    a default sort in that case rather than erroring out.
    """
    if not sort_param:
        return None
    descending = sort_param.startswith("-")
    field_name = sort_param[1:] if descending else sort_param
    if not field_name or field_name not in allowed_fields:
        return None
    return field_name, descending


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Resource not found.", "field_errors": None},
    )


def _integrity_error(message: str = "The request violates a data constraint.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"code": "integrity_error", "message": message, "field_errors": None},
    )


def _restrict_blocked() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "restrict_blocked",
            "message": "This item cannot be deleted because other records reference it.",
            "field_errors": None,
        },
    )


@dataclass
class CrudEntityConfig:
    model: type[Base]
    resource: str  # e.g. "goal" -> routes at /goals, /goals/{id}
    create_schema: type[BaseModel]
    update_schema: type[BaseModel]
    summary_schema: type[BaseModel]
    scope_field: str = "org_id"
    search_fields: tuple[str, ...] = ()
    filter_fields: tuple[str, ...] = ()
    methods: frozenset[str] = field(
        default_factory=lambda: frozenset({"list", "get", "create", "update", "delete"})
    )


def make_crud_router(config: CrudEntityConfig) -> APIRouter:
    router = APIRouter()
    resource = config.resource
    prefix = f"/{resource}s"
    allowed_sort_fields = (*config.filter_fields, "created_at")

    if "list" in config.methods:

        @router.get(prefix, response_model=None)
        async def list_items(
            request: Request,
            org_id: uuid.UUID = Query(...),
            page: int = Query(1, ge=1),
            page_size: int = Query(20, ge=1, le=100),
            sort: str | None = Query(None),
            q: str | None = Query(None),
            db: AsyncSession = Depends(get_db),
            user: User = Depends(get_current_user),
        ) -> dict[str, Any]:
            await check_org_access(db, user.id, org_id, f"{resource}.list")

            page, page_size = clamp_pagination(page, page_size)

            filters = [getattr(config.model, config.scope_field) == org_id]
            for filter_field in config.filter_fields:
                value = request.query_params.get(filter_field)
                if value is not None:
                    filters.append(getattr(config.model, filter_field) == value)

            if q and config.search_fields:
                like_term = f"%{q}%"
                filters.append(
                    or_(*[getattr(config.model, f).ilike(like_term) for f in config.search_fields])
                )

            base_stmt = select(config.model).where(and_(*filters))
            total = (
                await db.execute(select(func.count()).select_from(base_stmt.subquery()))
            ).scalar_one()

            parsed_sort = parse_sort(sort, allowed_sort_fields)
            if parsed_sort is not None:
                sort_field, descending = parsed_sort
                order_col = getattr(config.model, sort_field)
                base_stmt = base_stmt.order_by(order_col.desc() if descending else order_col.asc())
            else:
                base_stmt = base_stmt.order_by(config.model.created_at.desc())

            base_stmt = base_stmt.offset((page - 1) * page_size).limit(page_size)
            rows = (await db.execute(base_stmt)).scalars().all()

            items = [config.summary_schema.model_validate(row) for row in rows]
            return {"items": items, "total": total, "page": page, "page_size": page_size}

    if "get" in config.methods:

        @router.get(prefix + "/{item_id}", response_model=config.summary_schema)
        async def get_item(
            item_id: uuid.UUID,
            db: AsyncSession = Depends(get_db),
            user: User = Depends(get_current_user),
        ) -> Any:
            row = await db.get(config.model, item_id)
            if row is None:
                raise _not_found()
            org_id = getattr(row, config.scope_field)
            await check_org_access(db, user.id, org_id, f"{resource}.get")
            return row

    if "create" in config.methods:

        @router.post(prefix, response_model=config.summary_schema, status_code=status.HTTP_201_CREATED)
        async def create_item(
            payload: config.create_schema,
            db: AsyncSession = Depends(get_db),
            user: User = Depends(get_current_user),
        ) -> Any:
            org_id = getattr(payload, config.scope_field)
            await check_org_access(db, user.id, org_id, f"{resource}.create")

            row = config.model(**payload.model_dump())
            if hasattr(config.model, "created_by_user_id"):
                row.created_by_user_id = user.id

            db.add(row)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                raise _integrity_error() from None
            await db.refresh(row)
            return row

    if "update" in config.methods:

        @router.patch(prefix + "/{item_id}", response_model=config.summary_schema)
        async def update_item(
            item_id: uuid.UUID,
            payload: config.update_schema,
            db: AsyncSession = Depends(get_db),
            user: User = Depends(get_current_user),
        ) -> Any:
            row = await db.get(config.model, item_id)
            if row is None:
                raise _not_found()
            org_id = getattr(row, config.scope_field)
            await check_org_access(db, user.id, org_id, f"{resource}.update")

            for field_name, value in payload.model_dump(exclude_unset=True).items():
                setattr(row, field_name, value)

            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                raise _integrity_error() from None
            await db.refresh(row)
            return row

    if "delete" in config.methods:

        @router.delete(prefix + "/{item_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
        async def delete_item(
            item_id: uuid.UUID,
            db: AsyncSession = Depends(get_db),
            user: User = Depends(get_current_user),
        ) -> None:
            row = await db.get(config.model, item_id)
            if row is None:
                raise _not_found()
            org_id = getattr(row, config.scope_field)
            await check_org_access(db, user.id, org_id, f"{resource}.delete")

            await db.delete(row)
            try:
                await db.flush()
                await db.commit()
            except IntegrityError:
                await db.rollback()
                raise _restrict_blocked() from None
            return None

    return router


__all__ = ["CrudEntityConfig", "make_crud_router", "clamp_pagination", "parse_sort"]
