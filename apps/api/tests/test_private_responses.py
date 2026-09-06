from fastapi.testclient import TestClient

from nuzenio_api.db import get_db
from nuzenio_api.main import app


def test_unexpected_private_errors_also_forbid_caching():
    def failed_dependency():
        raise RuntimeError("Fixture-only failure")

    app.dependency_overrides[get_db] = failed_dependency
    try:
        response = TestClient(app, raise_server_exceptions=False).get("/v1/admin/auth/session")
        assert response.status_code == 500
        assert "no-store" in response.headers.get("cache-control", "")
        assert "private" in response.headers.get("cache-control", "")
        assert "Fixture-only" not in response.text
    finally:
        app.dependency_overrides.pop(get_db, None)
