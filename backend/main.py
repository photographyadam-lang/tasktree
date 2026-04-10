import os
import json
import httpx
import psutil
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import logging

from utils.json_cleaner import clean_llm_json
from utils.node_validator import validate_and_repair_node

# Load .env spanning gracefully up relative path logic 
load_dotenv(dotenv_path="../.env")

# Safe Production Output Logging (AC Rule 11/6)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security Check (AC 1) relaxed for Local-only execution viability
ANTHROPIC_API_KEY = os.getenv("VITE_ANTHROPIC_API_KEY", "")
if not ANTHROPIC_API_KEY:
    logger.warning("VITE_ANTHROPIC_API_KEY is missing. Cloud endpoints will fail.")

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
    model: str = "qwen3:14b"  # User-selected model, with sensible default

@app.get("/api/models")
async def get_available_models():
    """Returns available Ollama models with memory requirements and current system RAM."""
    ollama_url = os.getenv("VITE_OLLAMA_BASE_URL", "http://localhost:11434")
    
    # Get current system memory
    mem = psutil.virtual_memory()
    available_gb = mem.available / (1024 ** 3)
    total_gb = mem.total / (1024 ** 3)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ollama_url}/api/tags", timeout=5.0)
            response.raise_for_status()
            data = response.json()
            
            models = []
            for m in data.get("models", []):
                size_bytes = m.get("size", 0)
                size_gb = size_bytes / (1024 ** 3)
                fits = size_gb <= available_gb
                models.append({
                    "name": m["name"],
                    "size_gb": round(size_gb, 1),
                    "fits_in_ram": fits,
                })
            
            # Sort: fits-in-RAM first, then by size ascending
            models.sort(key=lambda x: (not x["fits_in_ram"], x["size_gb"]))
            
            return {
                "models": models,
                "system_ram_available_gb": round(available_gb, 1),
                "system_ram_total_gb": round(total_gb, 1),
            }
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama is not running. Start Ollama and try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query Ollama models: {str(e)}")


@app.post("/llm/local")
async def process_local_ollama(request: DecomposeRequest):
    """Hits local Ollama explicitly handling 503 fallback routing securely."""
    logger.info("Executing POST /llm/local (Ollama)")
    ollama_url = os.getenv("VITE_OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model = request.model  # Use user-selected model from request
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": ollama_model,
                    "prompt": request.userPrompt,
                    "stream": False,
                    "options": {"temperature": 0.2}
                },
                timeout=180.0
            )
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Ollama model '{ollama_model}' not found. Run: ollama pull {ollama_model}")
            
            if not response.is_success:
                # Try to surface a meaningful reason (e.g. OOM) from the Ollama error body
                try:
                    err_body = response.json()
                    err_msg = err_body.get("error", response.text)
                except Exception:
                    err_msg = response.text
                logger.error(f"Ollama error ({response.status_code}): {err_msg}")
                if "memory" in err_msg.lower():
                    raise HTTPException(status_code=503, detail=f"Model '{ollama_model}' requires more RAM than is available. Select a smaller model.")
                raise HTTPException(status_code=502, detail=f"Ollama error: {err_msg}")
                
            data = response.json()
            raw_result = data.get("response", "")
            # Authoritative parent_id from the decomposed node — never trust the LLM to set this
            parent_id = request.nodePayload.get('id', '')
            # Enforce hierarchy: derive the correct child type from the parent's type
            parent_type = str(request.nodePayload.get('type', '')).lower()
            child_type_map = {'project': 'epic', 'epic': 'task', 'task': 'leaf_task'}
            expected_child_type = child_type_map.get(parent_type, '')
            return _process_and_validate_response(raw_result, parent_id, expected_child_type)
            
    except httpx.ConnectError:
        logger.error("Failed connecting to Ollama.")
        raise HTTPException(status_code=503, detail="Start Ollama and try again.")
    except HTTPException:
        raise  # Let 422/503/404 from _process_and_validate_response propagate unchanged
    except Exception as e:
        logger.error(f"Local LLM Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Local LLM Execution Failed: {str(e)}")


@app.post("/llm/cloud")
async def process_cloud_anthropic(request: DecomposeRequest):
    """Reaches robust APIs ensuring highest parsing parameters mapped consistently."""
    logger.info("Executing POST /llm/cloud (Anthropic)")
    
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Server misconfigured: VITE_ANTHROPIC_API_KEY is required for Cloud Decomposition! Update .env.")
    
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


def _process_and_validate_response(raw_text: str, parent_id: str = "", expected_child_type: str = ""):
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
            # Inject authoritative parent_id — never rely on LLM to set it correctly
            if parent_id:
                raw_node['parent_id'] = parent_id
            # Enforce hierarchy: override type to the correct child level regardless of what LLM returned
            if expected_child_type:
                actual = str(raw_node.get('type', '')).lower()
                if actual != expected_child_type:
                    logger.warning(f"LLM returned type '{actual}' but expected '{expected_child_type}' — correcting.")
                    raw_node['type'] = expected_child_type
            repaired = validate_and_repair_node(raw_node)
            validated_nodes.append(repaired)
        except ValueError as ve:
            # 422 Invalid mapping explicit fallback triggers frontend sandbox mapping UI alerts gracefully
            logger.error(f"Node validation rejected item natively: {str(ve)}")
            raise HTTPException(status_code=422, detail=str(ve))
            
    return {"status": "success", "nodes": validated_nodes}
