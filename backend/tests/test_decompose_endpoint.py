import pytest
import httpx
from httpx import ASGITransport
import respx
import json


MOCK_VALID_RESPONSE = json.dumps([
    {
        "id": "test-id-123",
        "title": "Implement Auth Module",
        "type": "task",
        "parent_id": "parent-id-456",
        "summary": "Build JWT authentication",
        "objective": "Secure the API",
        "risk": "medium",
        "size": "medium",
        "scope": ["JWT tokens", "refresh logic"],
        "out_of_scope": ["OAuth providers"],
        "prerequisites": [],
        "depends_on": [],
        "success_criteria": ["Token validates correctly"],
        "tests": ["test_auth.py"],
        "validation_commands": ["pytest tests/test_auth.py"],
        "notes": "",
    }
])

MOCK_OLLAMA_PAYLOAD = {
    "response": MOCK_VALID_RESPONSE
}

DECOMPOSE_BODY = {
    "nodePayload": {"id": "parent-id-456", "title": "Auth Epic"},
    "ancestorChain": [],
    "userPrompt": "Decompose this",
    "model": "qwen3:14b"
}


@pytest.mark.anyio
@respx.mock
async def test_decompose_local_happy_path():
    """Full pipeline: FastAPI /llm/decompose → mocked Ollama → validated node returned."""
    respx.post("http://localhost:11434/api/generate").mock(
        return_value=httpx.Response(200, json=MOCK_OLLAMA_PAYLOAD)
    )

    from main import app
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r = await client.post("/llm/decompose", json=DECOMPOSE_BODY)

    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert len(data["nodes"]) == 1
    assert data["nodes"][0]["title"] == "Implement Auth Module"
    assert "id" in data["nodes"][0]
    assert "created_at" in data["nodes"][0]


@pytest.mark.anyio
@respx.mock
async def test_decompose_local_ollama_oom_error():
    """OOM error from Ollama should surface a human-readable 503, not a raw 500."""
    respx.post("http://localhost:11434/api/generate").mock(
        return_value=httpx.Response(500, json={"error": "model requires more system memory than is available"})
    )

    from main import app
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r = await client.post("/llm/decompose", json={**DECOMPOSE_BODY, "model": "qwen2.5-coder:32b"})

    assert r.status_code == 503
    assert "RAM" in r.json()["detail"] or "memory" in r.json()["detail"].lower()


@pytest.mark.anyio
@respx.mock
async def test_decompose_local_ollama_offline():
    """If Ollama is completely offline, return 503 with clear message."""
    respx.post("http://localhost:11434/api/generate").mock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    from main import app
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r = await client.post("/llm/decompose", json=DECOMPOSE_BODY)

    assert r.status_code == 503


@pytest.mark.anyio
@respx.mock
async def test_decompose_local_missing_parent_id_is_injected():
    """parent_id omitted by LLM must be injected from the request nodePayload.id — not rejected."""
    # Mock response where LLM forgot to set parent_id (common with small models)
    response_without_parent_id = json.dumps([{
        "title": "Write Unit Tests",
        "type": "task",
        # parent_id intentionally missing
        "summary": "Write comprehensive unit tests",
        "objective": "Ensure code quality",
        "risk": "low",
        "size": "small",
        "scope": [],
        "out_of_scope": [],
        "prerequisites": [],
        "depends_on": [],
        "notes": "",
    }])
    respx.post("http://localhost:11434/api/generate").mock(
        return_value=httpx.Response(200, json={"response": response_without_parent_id})
    )

    from main import app
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r = await client.post("/llm/decompose", json={
            "nodePayload": {"id": "the-real-parent-id", "title": "Auth Epic"},
            "ancestorChain": [],
            "userPrompt": "Decompose this",
            "model": "qwen3:14b"
        })

    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["nodes"][0]["parent_id"] == "the-real-parent-id", "parent_id should be injected from request"


@pytest.mark.anyio
@respx.mock
async def test_decompose_local_bad_json_from_llm():
    """If LLM returns garbage JSON, return 422."""
    respx.post("http://localhost:11434/api/generate").mock(
        return_value=httpx.Response(200, json={"response": "Sure! Here are some ideas... not JSON at all."})
    )

    from main import app
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r = await client.post("/llm/decompose", json=DECOMPOSE_BODY)

    assert r.status_code == 422
