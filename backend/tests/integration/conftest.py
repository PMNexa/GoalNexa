"""In-process ASGI test client for integration tests.

Uses `httpx.ASGITransport` against the app directly — no live server, no
docker-compose — plus an autouse fixture that pings `/health` first so a
broken app boot fails fast with a clear error instead of masking itself
behind whatever the first real test assertion happens to be.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture()
async def client(db_schema):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
async def _health_check_first(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
