# Production image of apps/main's backend: every module's Django app
# pip-installed (not editable - the source is baked in), gunicorn in
# front. Build from the repo root, not this directory - the module
# backends are siblings under apps/:
#   docker build -f apps/main/backend/Dockerfile -t goalnexa-backend .
# Migrations are NOT run on start (several replicas would race); run
# them once per release: `docker compose -f docker-compose.prod.yml run
# --rm migrate`, or the host's own release step (`manage.py migrate &&
# manage.py createcachetable`), before rolling out.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /apps
COPY apps/platform-core/backend platform-core/backend
COPY apps/platform-auth/backend platform-auth/backend
COPY apps/platform-org/backend platform-org/backend
COPY apps/goalnexa/backend goalnexa/backend
COPY apps/platform-mcp/backend platform-mcp/backend
COPY apps/main/backend/requirements.txt main/backend/requirements.txt

# Extra pip args for a downstream build's extensions (GOALNEXA_EXTENSIONS),
# e.g. --build-arg BACKEND_EXTRA_PIP=/apps/platform-billing/backend after
# a COPY of it - or a fork's own Dockerfile FROM this image.
ARG BACKEND_EXTRA_PIP=""
RUN pip install -r main/backend/requirements.txt \
    ./platform-core/backend ./platform-auth/backend ./platform-org/backend \
    ./goalnexa/backend ./platform-mcp/backend ${BACKEND_EXTRA_PIP}

COPY apps/main/backend/manage.py main/backend/manage.py
COPY apps/main/backend/config main/backend/config
WORKDIR /apps/main/backend
RUN DJANGO_DEBUG=false python manage.py collectstatic --noinput

RUN useradd --system --uid 1000 app
USER app

EXPOSE 8000
# WEB_CONCURRENCY: gunicorn worker processes (~2 x CPU cores + 1).
CMD ["sh", "-c", "exec gunicorn config.wsgi --bind 0.0.0.0:8000 --workers ${WEB_CONCURRENCY:-3} --access-logfile - --forwarded-allow-ips '*'"]
