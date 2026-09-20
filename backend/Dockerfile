# Build context is the REPO ROOT (see docker-compose.yml's `context: .`,
# `dockerfile: backend/Dockerfile`), not this directory — this image needs
# both `backend/` and the `platform-core/` git submodule, which sits at the
# repo root as a sibling of `backend/`, not inside it.
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY platform-core/backend ./platform-core/backend
COPY backend/pyproject.toml ./backend/
COPY backend/goalnexa_ext ./backend/goalnexa_ext
COPY backend/alembic ./backend/alembic
COPY backend/alembic.ini ./backend/

# platform-core's `app` package is installed editable (adds its source dir
# to this venv's import path) rather than copied — this project consumes it
# "in place" as a git submodule, not as a vendored copy (see README.md).
RUN pip install --no-cache-dir -e ./platform-core/backend \
    && pip install --no-cache-dir -e ./backend

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "goalnexa_ext.asgi:app", "--host", "0.0.0.0", "--port", "8000"]
