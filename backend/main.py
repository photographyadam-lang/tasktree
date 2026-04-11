import os
import json
import httpx
import psutil
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import logging

from utils.json_cleaner import clean_llm_json, clean_llm_json_object
from utils.node_validator import validate_and_repair_node
from models.review import NodeReviewReport, ReviewIssue  # noqa: F401 (ReviewIssue imported for Pydantic resolution)
from models.regen import RegenResponse

# Load .env spanning gracefully up relative path logic 
load_dotenv(dotenv_path="../.env")

# Safe Production Output Logging (AC Rule 11/6)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security Check (AC 1) relaxed for Local-only execution viability
ANTHROPIC_API_KEY = os.getenv("VITE_ANTHROPIC_API_KEY", "")
if not ANTHROPIC_API_KEY:
    logger.warning("VITE_ANTHROPIC_API_KEY is missing. Cloud endpoints will fail.")

CLOUD_MODEL = "claude-3-5-sonnet-20241022"

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
    model: str = "gemma4:e2b"  # User-selected model, updated default


@app.get("/api/models")
async def get_available_models():
    """Returns available models, including Claude and Ollama models."""
    ollama_url = os.getenv("VITE_OLLAMA_BASE_URL", "http://localhost:11434")
    
    # Get current system memory
    mem = psutil.virtual_memory()
    available_gb = mem.available / (1024 ** 3)
    total_gb = mem.total / (1024 ** 3)
    
    models = []
    
    # Always try to fetch Ollama
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ollama_url}/api/tags", timeout=5.0)
            response.raise_for_status()
            data = response.json()
            
            for m in data.get("models", []):
                size_bytes = m.get("size", 0)
                size_gb = size_bytes / (1024 ** 3)
                fits = size_gb <= available_gb
                models.append({
                    "name": m["name"],
                    "size_gb": round(size_gb, 1),
                    "fits_in_ram": fits,
                })
    except httpx.ConnectError:
        logger.warning("Ollama is not running. Only showing Claude if available.")
    except Exception as e:
        logger.warning(f"Failed to query Ollama models: {str(e)}")

    # Sort Ollama: fits-in-RAM first, then by size ascending
    models.sort(key=lambda x: (not x["fits_in_ram"], x["size_gb"]))

    # Add Claude to the top
    models.insert(0, {
        "name": CLOUD_MODEL,
        "size_gb": 0,
        "fits_in_ram": bool(ANTHROPIC_API_KEY)
    })
    
    return {
        "models": models,
        "system_ram_available_gb": round(available_gb, 1),
        "system_ram_total_gb": round(total_gb, 1),
    }


async def _invoke_ollama(model: str, system_prompt: str, user_prompt: str, temperature: float = 0.2):
    """Encapsulates Ollama generation."""
    ollama_url = os.getenv("VITE_OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": model,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "keep_alive": 0,
                    "options": {"temperature": temperature}
                },
                timeout=180.0
            )
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Ollama model '{model}' not found. Run: ollama pull {model}")
            
            if not response.is_success:
                try:
                    err_body = response.json()
                    err_msg = err_body.get("error", response.text)
                except Exception:
                    err_msg = response.text
                logger.error(f"Ollama error ({response.status_code}): {err_msg}")
                if "memory" in err_msg.lower():
                    raise HTTPException(status_code=503, detail=f"Model '{model}' requires more RAM than is available.")
                raise HTTPException(status_code=502, detail=f"Ollama error: {err_msg}")
                
            return response.json().get("response", "")
    except httpx.ConnectError:
        logger.error("Failed connecting to Ollama.")
        raise HTTPException(status_code=503, detail="Start Ollama and try again.")


async def _invoke_anthropic(model: str, system_prompt: str, user_prompt: str, temperature: float = 0.2, max_tokens: int = 4096):
    """Encapsulates Anthropic Claude generation."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Server misconfigured: VITE_ANTHROPIC_API_KEY is required.")
    
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
                    "model": CLOUD_MODEL,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}]
                },
                timeout=180.0
            )
            response.raise_for_status()
            data = response.json()
            return data.get("content", [{}])[0].get("text", "")
    except httpx.HTTPStatusError as e:
        logger.error(f"Anthropic API error: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Anthropic error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cloud LLM Execution Failed: {str(e)}")


@app.post("/llm/decompose")
async def decompose_node(request: DecomposeRequest):
    """Routes the decompose request to right Model internally."""
    logger.info(f"Executing POST /llm/decompose with model: {request.model}")
    
    try:
        if request.model == CLOUD_MODEL:
            # Using Cloud
            raw_result = await _invoke_anthropic(
                model=CLOUD_MODEL,
                system_prompt="",
                user_prompt=request.userPrompt,
                temperature=0.2,
                max_tokens=4096
            )
        else:
            # Using Local
            raw_result = await _invoke_ollama(
                model=request.model,
                system_prompt="",
                user_prompt=request.userPrompt,
                temperature=0.2
            )
            
        parent_id = request.nodePayload.get('id', '')
        parent_type = str(request.nodePayload.get('type', '')).lower()
        child_type_map = {'project': 'epic', 'epic': 'task', 'task': 'leaf_task'}
        expected_child_type = child_type_map.get(parent_type, '')
        
        return _process_and_validate_response(raw_result, parent_id, expected_child_type)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decompose LLM Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Decompose Execution Failed: {str(e)}")


REVIEW_SYSTEM_PROMPT = """You are a senior software architect reviewing a task specification for clarity and completeness.
Your job is to identify gaps that would cause an AI coding agent to produce incorrect, incomplete, or out-of-scope code.
You must return a single JSON object matching this schema exactly — no markdown, no explanation, no preamble:
{
  "passed": boolean,
  "readiness": "green" | "amber" | "red",
  "issues": [
    {
      "field": string,
      "severity": "blocking" | "refine",
      "problem": string,
      "suggestion": string
    }
  ]
}
Rules:
- passed is true only when issues is empty.
- readiness is "red" if any issue has severity "blocking", "amber" if issues exist but none are blocking, "green" if no issues.
- severity "blocking" means an AI coding agent cannot safely proceed without this being fixed.
- severity "refine" means the task is actionable but would produce better results if improved.
- Return { "passed": true, "readiness": "green", "issues": [] } if the task is genuinely complete.
- Never invent issues. Only report real gaps."""


class ReviewRequest(BaseModel):
    node: dict  # the full node object from Dexie
    model: str = "gemma4:e2b"


@app.post("/llm/review")
async def review_node(request: ReviewRequest):
    """Runs a structured LLM review of a node spec and returns a NodeReviewReport."""
    logger.info(f"Executing POST /llm/review with model: {request.model}")

    node = request.node
    user_prompt = f"""Review this task specification and return a NodeReviewReport JSON object.

Node type: {node.get('type', 'unknown')}
Title: {node.get('title', '')}
Objective: {node.get('objective', '[missing]')}
Summary: {node.get('summary', '[missing]')}
Scope: {', '.join(node.get('scope', [])) or '[missing]'}
Out of scope: {', '.join(node.get('out_of_scope', [])) or '[missing]'}
Prerequisites: {', '.join(node.get('prerequisites', [])) or '[missing]'}
Success criteria: {'; '.join(node.get('success_criteria', [])) or '[missing]'}
Tests: {'; '.join(node.get('tests', [])) or '[missing]'}
Validation commands: {'; '.join(node.get('validation_commands', [])) or '[missing]'}
Risk: {node.get('risk', '[missing]')}
Size: {node.get('size', '[missing]')}

Identify any gaps that would cause an AI coding agent to produce incorrect, incomplete, or out-of-scope results.
Return only the JSON object."""

    try:
        if request.model == CLOUD_MODEL:
            raw_text = await _invoke_anthropic(
                model=CLOUD_MODEL,
                system_prompt=REVIEW_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.0,
                max_tokens=2048
            )
        else:
            raw_text = await _invoke_ollama(
                model=request.model,
                system_prompt=REVIEW_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.0
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Review LLM error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Review request failed: {str(e)}")

    cleaned = clean_llm_json_object(raw_text)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse review response as JSON. Raw: {raw_text!r}")
        raise HTTPException(status_code=422, detail={"error": "review_parse_failed", "raw": raw_text})

    try:
        report = NodeReviewReport.model_validate(payload)
    except Exception as e:
        logger.error(f"NodeReviewReport validation failed: {str(e)}. Payload: {payload}")
        raise HTTPException(status_code=422, detail={"error": "review_parse_failed", "raw": raw_text})

    return report.model_dump()


REGEN_SYSTEM_PROMPT = """You are a senior software architect improving a task specification based on a developer's instruction.
Your job is to update only the fields the instruction asks you to change — return a JSON object containing only those fields.
Do not return unchanged fields. Do not add explanation or preamble. Return only valid JSON.
The JSON object must contain only fields from this list:
title, objective, summary, scope, out_of_scope, prerequisites, success_criteria, tests, validation_commands, notes, size, risk
Array fields (scope, out_of_scope, prerequisites, success_criteria, tests, validation_commands) must be JSON arrays of strings.
String fields (title, objective, summary, notes, size, risk) must be plain strings."""


class RegenRequest(BaseModel):
    node: dict
    instructions: str
    architecture_context: str = ""
    model: str = "gemma4:e2b"


@app.post("/llm/regen")
async def regen_node(request: RegenRequest):
    """Regenerates specific node fields based on developer instructions."""
    logger.info(f"Executing POST /llm/regen with model: {request.model}")

    node = request.node
    instructions = request.instructions
    architecture_context = request.architecture_context

    user_prompt = f"""Current task specification:

Node type: {node.get('type', 'unknown')}
Title: {node.get('title', '')}
Objective: {node.get('objective', '[missing]')}
Summary: {node.get('summary', '[missing]')}
Scope: {json.dumps(node.get('scope', []))}
Out of scope: {json.dumps(node.get('out_of_scope', []))}
Prerequisites: {json.dumps(node.get('prerequisites', []))}
Success criteria: {json.dumps(node.get('success_criteria', []))}
Tests: {json.dumps(node.get('tests', []))}
Validation commands: {json.dumps(node.get('validation_commands', []))}
Notes: {node.get('notes', '')}
Size: {node.get('size', '')}
Risk: {node.get('risk', '')}

{'Architecture context: ' + architecture_context if architecture_context else ''}

Developer instruction: {instructions}

Return only the JSON object containing the fields you changed. Do not explain."""

    try:
        if request.model == CLOUD_MODEL:
            raw_text = await _invoke_anthropic(
                model=CLOUD_MODEL,
                system_prompt=REGEN_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=2048
            )
        else:
            raw_text = await _invoke_ollama(
                model=request.model,
                system_prompt=REGEN_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Regen LLM error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Regen request failed: {str(e)}")

    cleaned = clean_llm_json_object(raw_text)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse regen response as JSON. Raw: {raw_text!r}")
        raise HTTPException(status_code=422, detail={"error": "regen_parse_failed", "raw": raw_text})

    try:
        result = RegenResponse.model_validate(payload)
    except Exception as e:
        logger.error(f"RegenResponse validation failed: {str(e)}. Payload: {payload}")
        raise HTTPException(status_code=422, detail={"error": "regen_parse_failed", "raw": raw_text})

    return result.model_dump(exclude_none=True)


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
