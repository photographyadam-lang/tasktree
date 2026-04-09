import os
import json
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import logging

from utils.json_cleaner import clean_llm_json
from utils.node_validator import validate_and_repair_node

# Load .env spanning gracefully up relative path logic 
load_dotenv(dotenv_path="../.env")

# Fail Fast Security Check (AC 1)
ANTHROPIC_API_KEY = os.getenv("VITE_ANTHROPIC_API_KEY", "")
if not ANTHROPIC_API_KEY:
    raise RuntimeError("Backend failed to start: ANTHROPIC_API_KEY is missing from .env.")

# Safe Production Output Logging (AC Rule 11/6)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Strict localhost tying (Privacy Check)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DecomposeRequest(BaseModel):
    nodePayload: dict
    ancestorChain: list
    userPrompt: str

@app.post("/llm/local")
async def process_local_ollama(request: DecomposeRequest):
    """Hits local Ollama explicitly handling 503 fallback routing securely."""
    logger.info("Executing POST /llm/local (Ollama)")
    ollama_url = os.getenv("VITE_OLLAMA_BASE_URL", "http://localhost:11434")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.1", # Or default specified model
                    "prompt": request.userPrompt,
                    "stream": False,
                    "options": {"temperature": 0.2}
                },
                timeout=180.0
            )
            response.raise_for_status()
            data = response.json()
            raw_result = data.get("response", "")
            return _process_and_validate_response(raw_result)
            
    except httpx.ConnectError:
        logger.error("Failed connecting to Ollama.")
        raise HTTPException(status_code=503, detail="Start Ollama and try again.")
    except Exception as e:
        logger.error(f"Local LLM Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Local LLM Execution Failed: {str(e)}")


@app.post("/llm/cloud")
async def process_cloud_anthropic(request: DecomposeRequest):
    """Reaches robust APIs ensuring highest parsing parameters mapped consistently."""
    logger.info("Executing POST /llm/cloud (Anthropic)")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 4096,
                    "temperature": 0.2,
                    "messages": [{"role": "user", "content": request.userPrompt}]
                },
                timeout=180.0
            )
            response.raise_for_status()
            data = response.json()
            raw_result = data.get("content", [{}])[0].get("text", "")
            return _process_and_validate_response(raw_result)
            
    except Exception as e:
        logger.error(f"Cloud LLM Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cloud LLM Execution Failed: {str(e)}")


def _process_and_validate_response(raw_text: str):
    """Isolates the string mapping, parses the payload safely returning completely formatted dicts explicitly executing rules engine mappings."""
    # 1. Strip Markdown syntax guarantees JSON block exclusively mappings
    cleaned_json_string = clean_llm_json(raw_text)
    
    # 2. Strict Parse
    try:
        payload = json.loads(cleaned_json_string)
    except json.JSONDecodeError as jde:
        logger.error("Failed to parse cleaned LLM response into JSON.")
        raise HTTPException(status_code=422, detail="LLM Output did not conform to JSON structures.")
        
    # Ensure it's mapping array responses exactly based on System Guidelines dictates
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="LLM Output omitted Root Array wrapping.")
        
    # 3. Validation Sequence Native 
    validated_nodes = []
    for raw_node in payload:
        try:
            repaired = validate_and_repair_node(raw_node)
            validated_nodes.append(repaired)
        except ValueError as ve:
            # 422 Invalid mapping explicit fallback triggers frontend sandbox mapping UI alerts gracefully
            logger.error(f"Node validation rejected item natively: {str(ve)}")
            raise HTTPException(status_code=422, detail=str(ve))
            
    return {"status": "success", "nodes": validated_nodes}
