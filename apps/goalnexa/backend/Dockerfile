# core_api (errors/exceptions/pagination/filters/uuid7 utils,
# BaseSerializer/BaseViewSet) comes from the sibling apps/platform-core
# module instead of being vendored here - build this image from the repo
# root, not from this directory:
#   docker build -f apps/goalnexa/backend/Dockerfile -t goalnexa-backend .
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY apps/platform-core/backend /platform-core

COPY apps/goalnexa/backend/requirements.txt apps/goalnexa/backend/manage.py ./
COPY apps/goalnexa/backend/config ./config
COPY apps/goalnexa/backend/goalnexa ./goalnexa

RUN pip install --no-cache-dir -r requirements.txt -e /platform-core

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
