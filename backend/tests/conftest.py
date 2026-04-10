import pytest
import httpx


@pytest.fixture(scope="session")
def ollama_url():
    return "http://localhost:11434"


@pytest.fixture(scope="session")
def ollama_running(ollama_url):
    """Check if Ollama is running. Skip tests gracefully if not."""
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(f"{ollama_url}/api/tags")
            if r.status_code == 200:
                return True
    except Exception:
        pass
    return False


@pytest.fixture(autouse=False)
def require_ollama(ollama_running):
    """Use this fixture in tests that need Ollama to be running."""
    if not ollama_running:
        pytest.skip("⚠️  Ollama is not running — start Ollama before running integration tests")
