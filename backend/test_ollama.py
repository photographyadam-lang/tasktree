import httpx
import asyncio
import json

MODEL = "qwen2.5-coder:32b"
PROMPT = "Return ONLY a valid JSON array. Example: [{\"title\": \"Task\", \"type\": \"task\"}]"

async def test_tags():
    async with httpx.AsyncClient() as c:
        r = await c.get("http://localhost:11434/api/tags")
        data = r.json()
        models = [m["name"] for m in data.get("models", [])]
        print(f"Available models: {models}")
        print(f"Target model '{MODEL}' present: {MODEL in models}")

async def test_generate():
    async with httpx.AsyncClient() as c:
        try:
            r = await c.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": MODEL,
                    "prompt": PROMPT,
                    "stream": False,
                    "options": {"temperature": 0.2}
                },
                timeout=60.0
            )
            print(f"Status: {r.status_code}")
            if r.status_code == 200:
                resp_text = r.json().get("response", "")
                print(f"Response (first 200 chars): {resp_text[:200]}")
            else:
                print(f"Error body: {r.text[:500]}")
        except Exception as e:
            print(f"Exception: {e}")

asyncio.run(test_tags())
asyncio.run(test_generate())
