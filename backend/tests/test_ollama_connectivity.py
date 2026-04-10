import pytest
import httpx
import psutil


@pytest.mark.anyio
async def test_ollama_is_running(require_ollama, ollama_url):
    """Verifies Ollama is reachable and returns a valid model list."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{ollama_url}/api/tags", timeout=5.0)
        assert r.status_code == 200
        data = r.json()
        assert "models" in data
        assert len(data["models"]) > 0, "Ollama is running but has no models pulled"


@pytest.mark.anyio
async def test_configured_model_fits_in_ram(require_ollama, ollama_url):
    """Verifies that the available models include at least one that fits in current system RAM."""
    mem = psutil.virtual_memory()
    available_gb = mem.available / (1024 ** 3)

    async with httpx.AsyncClient() as client:
        r = await client.get(f"{ollama_url}/api/tags", timeout=5.0)
        data = r.json()

    models = data.get("models", [])
    fitting_models = [
        m["name"] for m in models
        if m.get("size", 0) / (1024 ** 3) <= available_gb
    ]

    assert len(fitting_models) > 0, (
        f"No Ollama models fit in available RAM ({available_gb:.1f} GB). "
        f"Pull a smaller model or free up RAM."
    )


@pytest.mark.anyio
async def test_models_endpoint_returns_correct_structure(require_ollama):
    """Tests the /api/models FastAPI endpoint returns the expected structure."""
    from main import app
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r = await client.get("/api/models")
        assert r.status_code == 200
        data = r.json()
        assert "models" in data
        assert "system_ram_available_gb" in data
        assert "system_ram_total_gb" in data
        # At least one model should exist
        assert len(data["models"]) > 0
        # Each model has required fields
        first = data["models"][0]
        assert "name" in first
        assert "size_gb" in first
        assert "fits_in_ram" in first
