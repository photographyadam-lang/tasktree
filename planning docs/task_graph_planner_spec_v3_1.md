# Task Graph Planner — Product Specification v3.1

**Stage:** Spec | **Scope:** Full App | **Purpose:** Personal Tool
**Version:** 3.1 — Implementation Safety Rails
**Date:** April 9, 2026

---

> **What changed in v3.1**
>
> Three targeted "safety rail" additions to prevent common Claude Code failure modes:
>
> 1. **§11.2 & §14 Phase 1** — Dexie index requirements for `parent_id` and `type` on the nodes table
> 2. **§11.3 & §14 Phase 3** — JSON Resilience Utility: a server-side cleaning layer that strips markdown fences and extracts valid JSON before the app ever tries to parse LLM output
> 3. **§8 & §11.5** — Response Validation Contract: every LLM response is validated against a required-field checklist before being written to Dexie, with explicit repair and rejection rules

---

## 1. Overview

Task Graph Planner is a local personal tool that helps a solo developer decompose a software project into a structured, dependency-aware task graph ready for LLM coding agents like Claude Code. Starting from a plain-language project brief, the app generates hierarchical epics and tasks, enriches each node with metadata, and exports the result as Markdown or JSON.

> **Scope Boundary — MVP is a Planner, Not a Tracker**
> Status fields, execution notes, and test result recording are Phase 2. The MVP produces a well-structured, export-ready task graph and stops there.

---

## 2. Problem Statement

LLM coding agents produce better results when given bounded, well-specified tasks with explicit validation criteria. Project planning today is typically too vague for reliable agent execution. Existing tools cover only part of the workflow — planning, code search, or task tracking — but none bridge the gap between project intent and a dependency-aware, agent-ready task graph.

---

## 3. Goals

- Transform a project brief into a hierarchical task graph.
- Produce tasks sized appropriately for LLM coding agents.
- Capture prerequisites, dependencies, tests, and success criteria per task.
- Support recursive decomposition: project → epics → tasks → leaf tasks.
- Identify parallelizable work and surface dependency relationships visually.
- Detect when a plan may have drifted from its original intent (stale node detection).
- Export a graph usable directly by coding agents or planning workflows.

---

## 4. Non-Goals

- Full project management replacement.
- Sprint tracking, time tracking, or staffing management.
- Automatic code generation inside the planner.
- Enterprise reporting or portfolio management.
- Execution status tracking, dev notes, or test result recording (Phase 2).

---

## 5. Target Users

**Primary:** A solo developer using Claude Code for AI-assisted software development.

**Secondary (future):**
- Startup teams building with AI-assisted development workflows.
- Technical leads planning agent-friendly work breakdowns.

---

## 6. Core User Flow

1. User enters a project brief at the top-level node.
2. User triggers **Brief Quality Check** — local LLM (Qwen via Ollama) assesses completeness and returns structured feedback. User revises brief if needed.
3. User presses **Make Epics** — cloud LLM (Claude Sonnet) generates initial epics.
4. User reviews epics in graph view. For each epic, the user can: manually edit all fields; trigger a one-shot LLM field review (returns structured gap report); trigger a one-shot LLM regeneration with specific instructions; or open the **Prompt Sandbox** to inspect the rendered prompt before sending.
5. User presses **Make Tasks** on any epic — cloud LLM decomposes it into tasks.
6. User reviews tasks. Same edit/review/regenerate/sandbox options as epics. System flags tasks that need further decomposition.
7. User presses **Make Leaf Tasks** on any task — cloud LLM decomposes it into leaf tasks with full metadata including validation commands.
8. User reviews leaf tasks. System flags leaf tasks missing validation criteria.
9. User exports the full graph, a branch, or selected nodes as Markdown or JSON.
10. User generates a Claude Code prompt for any task or leaf task.

---

## 7. Core Concepts

### 7.1 Node Types

| Node Type | Description |
|-----------|-------------|
| Project | The full initiative or target outcome. Root of the tree. |
| Epic / Area | A major functional or technical area. Direct child of Project. |
| Task | A unit of work that may be decomposed further. |
| Leaf Task | A task small enough to assign directly to an LLM coding agent. |
| Validation | Tests, commands, or checks that prove a leaf task is complete. |
| Risk / Constraint | Notes about ambiguity, dependency risk, or implementation uncertainty. |

### 7.2 Relationships

| Relationship | Meaning |
|-------------|---------|
| Depends on | Task B cannot start until Task A is complete. |
| Blocks | Task A prevents Task B from starting (inverse of depends on). |
| Related to | Informational link — no execution dependency. |
| Validates | A test or check proves a task is complete. |
| Contains | Parent-child hierarchy between decomposition levels. |

---

## 8. Task Schema

Every node stores the following fields. Fields marked `*` are required on leaf tasks before export.

> **⚠ v3.1 Addition — Response Validation Contract**
>
> Every LLM-generated node object must be validated against the required-field checklist in §11.6 before it is written to Dexie. See §11.6 for the full validation, repair, and rejection rules.

```json
{
  "id":                  "task-001",
  "title":               "Implement auth session persistence",
  "type":                "leaf_task",          // project | epic | task | leaf_task
  "parent_id":           "epic-auth",
  "summary":             "Persist user sessions across browser restarts.",
  "objective":           "Allow signed-in users to remain authenticated after refresh.",
  "scope":               ["cookie storage", "session restore"],
  "out_of_scope":        ["SSO", "multi-device sync"],
  "prerequisites":       ["auth API exists", "session model defined"],
  "depends_on":          ["task-000"],
  "success_criteria":    ["User remains signed in after refresh", "Tests pass"],   // *
  "tests":               ["unit tests", "integration test for refresh flow"],      // *
  "validation_commands": ["npm test", "npm run lint"],                             // *
  "risk":                "medium",             // low | medium | high
  "size":                "small",              // x-small | small | medium | large | x-large
  "notes":               "Use existing auth middleware where possible.",
  "created_at":          "2026-04-09T10:00:00Z",    // ISO string, set on creation
  "updated_at":          "2026-04-09T11:30:00Z",    // ISO string, updated on every write
  "last_decomposed_at":  "2026-04-09T11:00:00Z"     // ISO string | null
}
```

---

## 9. Functional Requirements

### 9.1 Project Ingestion

- Accept a project brief in plain language.
- Support optional structured inputs: repository links, files, docs.
- Support both greenfield planning and planning against an existing codebase.

### 9.2 Brief Quality Check

- User triggers a quality check before decomposition begins.
- Local LLM (Qwen via Ollama) assesses the brief for completeness.
- Returns structured JSON: `{ passed: bool, issues: string[] }`.
- User can proceed anyway or revise the brief and re-check.

> **ℹ Prompt Design Note**
> Write and test the brief quality check prompt before building this feature. Instruct the model to return structured JSON only: `{ passed: bool, issues: string[] }`.

### 9.3 Recursive Decomposition

- Users can expand any node into child nodes at the next level.
- Decomposition is always user-triggered — never automatic.
- Cloud LLM (Claude Sonnet) handles epic and task decomposition.
- Local LLM handles bounded quality checks and prompt generation.
- When decomposition completes, the parent node's `last_decomposed_at` is set to the current ISO timestamp.
- All LLM responses pass through the JSON Resilience Utility (§11.3) and Response Validation Contract (§11.6) before any node is written.

### 9.4 One-Shot Node Review

> **⚠ Architecture Decision**
> Per-node LLM review is one-shot only. A single request is sent; structured feedback appears in the edit panel. No conversational back-and-forth. Each review is independent.

- User can trigger a field review for any node at any time.
- Review checks all 11 metadata fields and returns a structured gap report.
- User can trigger a one-shot regeneration with specific natural language instructions.
- Regeneration output is validated (§11.6) before being applied.
- Regeneration replaces node fields — user confirms before overwrite.
- `updated_at` is written to Dexie on every confirmed field change.

### 9.5 Task Sizing Guidance

- System flags tasks that are too large, too ambiguous, or cross-cutting.
- Applies sizing heuristics to determine if a task is leaf-ready.
- Displays size estimate (x-small → x-large) on each node in the graph.

### 9.6 Dependency Management

> **⚠ v3 Technical Constraint — onConnect Handler**
>
> When a user draws an edge between two nodes in React Flow, the `onConnect` callback **must** immediately execute a `db.edges.put()` operation to the Dexie edges table. The write must use the `source` and `target` node IDs from React Flow's connection object. Do **not** defer this write, batch it, or route it through intermediate state. The edge must be persisted before the UI re-renders the connection.
>
> ```javascript
> const onConnect = useCallback(async (connection) => {
>   const edge = {
>     id: generateId(),
>     source_id: connection.source,
>     target_id: connection.target,
>     relationship_type: 'depends_on'  // default; user can edit post-creation
>   };
>   await db.edges.put(edge);
>   setEdges(eds => addEdge(connection, eds));
> }, []);
> ```

- Dependency edges are drawn by dragging from a node's output handle to a target node's input handle.
- Edge type is selected on drop via a small popover: `depends_on` | `blocks` | `related_to`.
- Circular dependency detection triggers a user warning and prevents the edge from being saved.

### 9.7 Validation Planning

- Every leaf task must include at least one `validation_command` or `test` before export.
- System warns if a leaf task is missing validation criteria.
- Validation types: automated tests, linting, build checks, smoke tests, manual review.

### 9.8 Export and Claude Code Prompt Generation

- Full graph, branch, or selected nodes exportable as Markdown or JSON.
- JSON export matches the task schema exactly, including all timestamp fields.
- Prompt generator creates a ready-to-paste Claude Code prompt for any task or leaf task.
- Prompt includes: task summary, objective, scope, prerequisites, success criteria, validation commands, and ancestor chain context.

---

## 10. Decomposition Rules

The LLM decomposition prompts encode these rules. The UI enforces them as warnings.

- Prefer functional boundaries over implementation details.
- Each leaf task has one primary goal.
- Avoid tasks that touch too many unrelated files or systems.
- Stop decomposing when the next split would create tasks too small to be useful.
- Require explicit validation for every leaf task.
- Preserve parent dependencies when splitting tasks into children.
- Surface uncertainty rather than guessing when scope is unclear.

### 10.1 Sizing Heuristics

A task is ready for execution when it is:

- Small enough to fit in one agent loop or a few short iterations.
- Narrow enough that required context can be loaded without overload.
- Clear enough that success can be verified automatically or with a short manual check.

A task should be split further when it is:

- Broad across multiple subsystems.
- Missing concrete validation.
- Dependent on unresolved design decisions.
- Likely to require multiple unrelated code changes.

---

## 11. Technical Architecture

> **⚠ Architecture Decision — FastAPI Proxy**
> A small local Python backend routes all LLM requests. The React frontend never holds API keys. Both services start with a single `start.sh` script. No cloud deployment needed — localhost only.

### 11.1 Component Overview

| Component | Technology | Complexity |
|-----------|------------|------------|
| Graph canvas | React + React Flow + Dagre.js | Medium |
| Node edit panel | React + Radix/Shadcn (slide-out) | Medium |
| Data layer | Dexie.js (IndexedDB, two tables) | Low |
| Decomposition engine | LLM calls + tree insertion logic | High |
| Dependency editor | React Flow custom edge handles | Medium |
| Export engine | Tree serialization → MD + JSON | Low |
| Prompt renderer | Pure function, no external deps | Low |
| Prompt Sandbox | Rendered prompt preview panel | Low |
| Claude Code prompt generator | Template from task metadata | Low |
| FastAPI proxy | Two explicit endpoints + utilities | Low |
| JSON Resilience Utility | Server-side LLM output cleaner | Low |
| Response Validation Contract | Field validation before Dexie write | Low |

---

### 11.2 Data Model

> **⚠ v3.1 Addition — Required Dexie Indexes**
>
> The `nodes` table **must** explicitly index `parent_id` and `type`. Without these indexes, Ancestor Path Highlighting degrades from O(depth) to O(n) full-table scans as the project grows, and List View filtering becomes unacceptably slow on large graphs.
>
> See Phase 1 in §14 for the exact Dexie schema declaration required.

Two Dexie.js tables stored in IndexedDB:

- **`nodes`** — `id`, `type`, `parent_id`, all metadata fields, `created_at`, `updated_at`, `last_decomposed_at`
- **`edges`** — `id`, `source_id`, `target_id`, `relationship_type` (`depends_on` | `blocks` | `related_to`)

Hierarchy is encoded via `parent_id` on each node. Dependencies are encoded as edges. Single-parent hierarchy only in MVP.

> **ℹ Design Note**
> Multiple parents (true DAG hierarchy) add significant UI complexity and are not needed for personal use. Dependency edges — not hierarchy — can connect any two nodes regardless of tree position.

#### Required Dexie Schema Declaration

```javascript
// db.js — Dexie schema. Must be declared exactly as shown.
// Indexed fields are listed after the primary key with commas.
// Non-indexed fields are NOT listed here — Dexie stores them automatically.

const db = new Dexie('TaskGraphPlanner');

db.version(1).stores({
  nodes: 'id, parent_id, type',
  // ↑ id = primary key
  // ↑ parent_id = indexed  → enables O(depth) ancestor traversal
  // ↑ type = indexed        → enables efficient List View filtering by type
  // All other fields (title, summary, etc.) are stored but not indexed.

  edges: 'id, source_id, target_id',
  // ↑ source_id and target_id indexed for bidirectional edge lookups
});
```

> **⚠ Critical Constraint**
> Do **not** add indexes to fields that are not queried directly (e.g., `title`, `summary`, `notes`). Unnecessary indexes increase write overhead with no query benefit. Only index `parent_id`, `type`, `source_id`, and `target_id`.

#### Stale Node Detection Logic

A child node is considered **Potentially Stale** when either of the following is true:

- The parent's `updated_at` is more recent than the child's `created_at` — the parent was edited after the child was generated from it.
- The parent's `updated_at` is more recent than the parent's own `last_decomposed_at` — the parent was edited after decomposition ran.

When either condition is true, affected child nodes display an amber **"Potentially Stale"** badge. The user can dismiss the flag or trigger a re-review or re-decomposition.

```javascript
// Staleness check — run whenever a node's updated_at changes
function isChildStale(parent, child) {
  const parentUpdated        = new Date(parent.updated_at);
  const childCreated         = new Date(child.created_at);
  const parentDecomposed     = parent.last_decomposed_at
                                 ? new Date(parent.last_decomposed_at)
                                 : null;

  const editedAfterCreation      = parentUpdated > childCreated;
  const editedAfterDecomposition = parentDecomposed && parentUpdated > parentDecomposed;

  return editedAfterCreation || editedAfterDecomposition;
}
```

---

### 11.3 LLM Routing Strategy

> **⚠ v3.1 Addition — JSON Resilience Utility**
>
> A server-side utility function must be applied to every LLM response before the content is returned to the React app. Cloud models frequently wrap JSON output in markdown code fences even when the prompt explicitly forbids it. This utility prevents the app from crashing on malformed responses.
>
> See the full specification and code below.

The FastAPI proxy exposes exactly two endpoints. No streaming, no WebSockets — simple POST/response only.

| Endpoint | Routes To | Use For |
|----------|-----------|---------|
| `POST /llm/local` | Ollama (local) | Brief quality check, node field review, prompt generation |
| `POST /llm/cloud` | Anthropic API (cloud) | Epic, task, and leaf task decomposition |

#### Request Payload (both endpoints)

```json
{
  "system_prompt": "string  — the role and output instructions for the model",
  "user_prompt":   "string  — the rendered prompt including all context",
  "temperature":   0.2
}
```

`temperature` guidance: use `0.0` for reviews and quality checks; `0.2` for decomposition; `0.3` for regeneration with user instructions.

#### Response (both endpoints)

```json
{
  "content": "string  — cleaned, validated LLM output (never raw)",
  "model":   "string  — model identifier used",
  "tokens":  { "input": 0, "output": 0 }
}
```

> **🚫 Critical Constraint**
> Both endpoints return simple JSON. Do **not** implement streaming (SSE, WebSocket, or chunked transfer). The task graph planner requires complete, parseable JSON responses before updating the graph.

#### JSON Resilience Utility

This utility runs **inside the FastAPI proxy** on every LLM response, before the content field is populated and returned to the React app. The React frontend never receives raw LLM output.

**Purpose:** Strip markdown code fences and extract the first valid JSON value (object or array) from the response string. If the model wraps output in ` ```json ... ``` ` or ` ``` ... ``` ` blocks despite being instructed not to, this utility recovers cleanly without crashing.

```python
# utils/json_cleaner.py

import re
import json
from typing import Any

def clean_llm_json(raw: str) -> Any:
    """
    Strips markdown code fences and extracts the first valid JSON
    object or array from a raw LLM response string.

    Raises ValueError if no valid JSON can be extracted.
    """
    # Step 1: Strip leading/trailing whitespace
    text = raw.strip()

    # Step 2: Remove markdown code fences
    # Handles ```json ... ```, ``` ... ```, and partial fences
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()

    # Step 3: Attempt direct parse first (fast path for clean responses)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Step 4: Find the first JSON object or array in the string
    # Handles cases where the model adds a preamble sentence before the JSON
    match = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"Could not extract valid JSON from LLM response. "
        f"First 200 chars: {raw[:200]!r}"
    )
```

**Integration point in the FastAPI route:**

```python
# routes/llm.py (illustrative)

from utils.json_cleaner import clean_llm_json

@app.post("/llm/cloud")
async def llm_cloud(payload: LLMRequest):
    raw_response = await call_anthropic(payload)       # raw string from API
    try:
        parsed = clean_llm_json(raw_response)          # clean before returning
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "content": parsed,     # already-parsed Python object; serialised to JSON by FastAPI
        "model":   "claude-sonnet-4-6",
        "tokens":  { ... }
    }
```

> **ℹ Note**
> The `content` field in the response is the **parsed Python object**, not a raw string. FastAPI serialises it automatically. The React app receives a proper JSON structure and never needs to call `JSON.parse()` on the content field.

#### LLM Task Routing Table

| Task | Endpoint | Temperature | Output Format |
|------|----------|-------------|---------------|
| Brief quality check | `POST /llm/local` | 0.0 | `{ passed: bool, issues: string[] }` |
| Generate epics from brief | `POST /llm/cloud` | 0.2 | `Task[]` matching schema |
| Generate tasks from epic | `POST /llm/cloud` | 0.2 | `Task[]` matching schema |
| Generate leaf tasks | `POST /llm/cloud` | 0.2 | `Task[]` matching schema |
| Node field review | `POST /llm/local` | 0.0 | `FieldReview[]` (see §9.4) |
| Node regeneration | `POST /llm/cloud` | 0.3 | `Task` object (partial update) |
| Claude Code prompt gen | `POST /llm/local` | 0.0 | Formatted string |

---

### 11.4 Prompt Contracts

All six prompts must be written and tested before the corresponding LLM integration is built.

- **Brief Quality Check** — output: `{ passed: bool, issues: string[] }`
- **Epic Generation** — output: array of epic objects matching schema
- **Task Generation** — output: array of task objects matching schema
- **Leaf Task Generation** — output: array of leaf task objects matching schema
- **Node Field Review** — output: `{ field: string, status: 'ok'|'missing'|'weak', note: string }[]`
- **Claude Code Prompt Generator** — output: formatted prompt string

> **⚠ Pre-Build Action Required**
> Test all six prompts manually in Claude.ai before writing any FastAPI integration code. Prompt quality is product quality. Do not skip this step.

---

### 11.5 The Golden Prompt — Epic Decomposition Template

The Epic Decomposition prompt is the structural standard for all decomposition prompts. Task and leaf task prompts follow the same pattern with adjusted role instructions and depth constraints.

**Sent to:** `POST /llm/cloud`
**Temperature:** `0.2`

#### System Prompt

```
You are a Senior Technical Architect with deep experience decomposing software projects
into well-scoped, agent-executable tasks. Your role is to analyse an epic and break it
down into a set of concrete tasks that a developer or LLM coding agent can execute
independently.

Output Rules:
- Return ONLY a valid JSON array. No preamble, no explanation, no markdown fences.
- Every object in the array must strictly conform to the Task Schema below.
- Do not omit required fields. Use null only where the schema explicitly allows it.
- Size each task using t-shirt sizing: x-small | small | medium | large | x-large.
- Prefer functional boundaries. Each task must have a single primary goal.
- Every task must include at least one entry in validation_commands.
- Surface uncertainty in the notes field rather than guessing.

Task Schema (all fields required unless marked nullable):
  id, title, type ('task'), parent_id, summary, objective,
  scope (array), out_of_scope (array), prerequisites (array),
  depends_on (array, may be empty), success_criteria (array),
  tests (array), validation_commands (array), risk ('low'|'medium'|'high'),
  size ('x-small'|'small'|'medium'|'large'|'x-large'),
  notes, created_at (ISO string), updated_at (ISO string),
  last_decomposed_at (null on creation)
```

#### User Prompt Template

```
Project Context:
  Title:       {{project.title}}
  Objective:   {{project.objective}}
  Constraints: {{project.notes}}

Ancestor Path (from Project root to this Epic):
  {{ancestor_chain}}
  (Each entry: { title, summary, objective })

Epic to Decompose:
  {{epic_object_as_json}}

Instructions:
  Break this epic into tasks. Each task must:
  - Be executable by a single developer or LLM coding agent in one focused session.
  - Have clear, testable success criteria.
  - Include at least one validation_command.
  - Respect the scope and out_of_scope boundaries of the parent epic.
  - Set depends_on correctly where execution order matters.
  - Set parent_id to: {{epic.id}}
  - Set created_at and updated_at to: {{current_iso_timestamp}}
  - Set last_decomposed_at to: null

Return a JSON array of task objects only. No other text.
```

> **ℹ Template Reuse**
> The Task Decomposition and Leaf Task Decomposition prompts follow the same structure. Change the role description ("break this task into leaf tasks"), the parent object passed in, and the `type` field value (`"leaf_task"`). All other patterns remain identical.

---

### 11.6 Response Validation Contract

> **⚠ v3.1 Addition — New Section**
>
> Every LLM response that is intended to produce node objects must be validated against the required-field checklist below **before** any node is written to Dexie. This validation runs in the FastAPI proxy, after the JSON Resilience Utility (§11.3) has already cleaned the response.
>
> This prevents silent data corruption where the model returns a partial object and the app writes it as-is, producing nodes with missing fields that cause downstream failures.

#### Required Fields Checklist

Every node object returned by the LLM must contain all of the following fields before it is accepted:

| Field | Type | Allowed Empty? |
|-------|------|----------------|
| `id` | string | No — must be non-empty |
| `title` | string | No — must be non-empty |
| `type` | string | No — must be one of: `project`, `epic`, `task`, `leaf_task` |
| `parent_id` | string | No — must match a known node id |
| `summary` | string | No — must be non-empty |
| `objective` | string | No — must be non-empty |
| `scope` | array | Yes — empty array acceptable |
| `out_of_scope` | array | Yes — empty array acceptable |
| `prerequisites` | array | Yes — empty array acceptable |
| `depends_on` | array | Yes — empty array acceptable |
| `success_criteria` | array | No — must contain at least one entry on leaf tasks |
| `tests` | array | No — must contain at least one entry on leaf tasks |
| `validation_commands` | array | No — must contain at least one entry on leaf tasks |
| `risk` | string | No — must be one of: `low`, `medium`, `high` |
| `size` | string | No — must be one of: `x-small`, `small`, `medium`, `large`, `x-large` |
| `notes` | string | Yes — empty string acceptable |
| `created_at` | string | No — must be a valid ISO 8601 string |
| `updated_at` | string | No — must be a valid ISO 8601 string |
| `last_decomposed_at` | string \| null | Yes — null is valid on creation |

#### Repair Rules (apply before rejection)

Attempt these repairs automatically before rejecting a node:

1. **Missing `id`** — generate a new UUID and assign it.
2. **Missing `created_at` or `updated_at`** — set both to the current ISO timestamp.
3. **Missing `last_decomposed_at`** — set to `null`.
4. **`scope`, `out_of_scope`, `prerequisites`, `depends_on` missing entirely** — set to `[]`.
5. **`notes` missing entirely** — set to `""`.

#### Rejection Rules (fail the request if unrepaired)

Reject the entire LLM response — do not write any nodes — if any node in the array has:

- Missing or empty `title`
- Missing or empty `summary`
- Missing or empty `objective`
- `type` not in the allowed enum
- `risk` not in the allowed enum
- `size` not in the allowed enum
- Missing `success_criteria`, `tests`, or `validation_commands` on a `leaf_task` node

When a rejection occurs, the FastAPI proxy returns HTTP 422 with a structured error:

```json
{
  "error": "validation_failed",
  "node_index": 2,
  "field": "success_criteria",
  "message": "leaf_task node at index 2 is missing required field: success_criteria"
}
```

The React app displays this error in the Prompt Sandbox panel and does not update the graph.

```python
# utils/node_validator.py

VALID_TYPES = {"project", "epic", "task", "leaf_task"}
VALID_RISKS = {"low", "medium", "high"}
VALID_SIZES = {"x-small", "small", "medium", "large", "x-large"}
LEAF_REQUIRED_ARRAYS = ["success_criteria", "tests", "validation_commands"]

def repair_node(node: dict, current_iso: str) -> dict:
    """Apply automatic repairs before validation."""
    if not node.get("id"):
        node["id"] = generate_uuid()
    if not node.get("created_at"):
        node["created_at"] = current_iso
    if not node.get("updated_at"):
        node["updated_at"] = current_iso
    if "last_decomposed_at" not in node:
        node["last_decomposed_at"] = None
    for field in ["scope", "out_of_scope", "prerequisites", "depends_on"]:
        if field not in node:
            node[field] = []
    if "notes" not in node:
        node["notes"] = ""
    return node

def validate_node(node: dict, index: int) -> None:
    """Raise ValueError if node fails any rejection rule."""
    for field in ["title", "summary", "objective"]:
        if not node.get(field):
            raise ValueError(f"node[{index}] missing required field: {field}")
    if node.get("type") not in VALID_TYPES:
        raise ValueError(f"node[{index}] invalid type: {node.get('type')!r}")
    if node.get("risk") not in VALID_RISKS:
        raise ValueError(f"node[{index}] invalid risk: {node.get('risk')!r}")
    if node.get("size") not in VALID_SIZES:
        raise ValueError(f"node[{index}] invalid size: {node.get('size')!r}")
    if node.get("type") == "leaf_task":
        for field in LEAF_REQUIRED_ARRAYS:
            if not node.get(field):
                raise ValueError(
                    f"leaf_task node[{index}] missing required field: {field}"
                )

def validate_node_array(nodes: list, current_iso: str) -> list:
    """Repair then validate all nodes. Returns repaired list or raises."""
    repaired = [repair_node(n, current_iso) for n in nodes]
    for i, node in enumerate(repaired):
        validate_node(node, i)
    return repaired
```

---

## 12. UX Design

### 12.1 Node Edit Panel

> **⚠ Architecture Decision**
> Node editing uses a slide-out side panel. Clicking any node opens the panel on the right. The graph remains visible and interactive while the panel is open.

- All 11 metadata fields are editable in the panel.
- LLM review output appears as a structured gap report within the panel.
- Regeneration: text input + confirm button. Overwrites fields on confirm after validation.
- `updated_at` is written to Dexie on every confirmed change.
- Panel can be pinned open or toggled.

### 12.2 Graph Canvas

- Hierarchical layout via Dagre.js — top-down tree.
- Node colour encodes type: project (blue), epic (teal), task (grey), leaf task (green).
- Dependency edges drawn by dragging from node handle to target node.
- Edge type selected on drop: `depends_on`, `blocks`, `related_to`.
- Right-click edge to delete.
- Zoom, pan, fit-to-view controls.
- Warning indicator on nodes with missing validation or quality issues.
- Potentially Stale nodes display an amber badge.

### 12.3 List View

- Flat list of leaf tasks only, sorted by dependency order (topological sort).
- Indexed `type` field enables efficient Dexie query: `db.nodes.where('type').equals('leaf_task')`.
- Filter: all leaf tasks | ready for agent | flagged | potentially stale.
- One-click export or prompt generation from list view.

### 12.4 Keyboard Shortcuts

- `E` — open edit panel for selected node
- `Cmd/Ctrl+Enter` — trigger decomposition on selected node
- `Cmd/Ctrl+E` — export current selection
- `Cmd/Ctrl+P` — generate Claude Code prompt for selected node
- `Cmd/Ctrl+Shift+S` — open Prompt Sandbox for selected node
- `Escape` — close panel

### 12.5 Prompt Sandbox

> **ℹ v3 Addition — Prompt Sandbox**
> Lets the user inspect the fully rendered prompt — including ancestor chain context — before it is sent to the LLM.

- Accessible from the node edit panel via a "Preview Prompt" button, and via `Cmd/Ctrl+Shift+S`.
- Displays the complete rendered prompt: system prompt + user prompt with all placeholders filled.
- Shows which endpoint will be used and the temperature setting.
- Shows the ancestor chain that will be injected as context.
- Read-only — changes must be made to node fields or the project brief.
- "Send" button triggers the actual LLM call after the user reviews.
- Token estimate displayed (approximate, based on character count).
- Validation errors from §11.6 are displayed here if a response is rejected.

### 12.6 Ancestor Path Highlighting

> **ℹ v3 Addition — Ancestor Path Highlighting**
> When a node is selected, the direct path from the Project root to that node is visually highlighted.

- All ancestor nodes and connecting edges are highlighted when a node is selected.
- Ancestor nodes use a distinct border colour (amber/gold) to distinguish from the selected node.
- Ancestor edges use a thicker stroke and distinct colour to trace the path.
- Non-ancestor nodes and edges dim slightly to reduce visual noise.
- Highlighting clears when the selection is deselected or the panel is closed.
- Ancestor path is computed by traversing `parent_id` from the selected node to the root — an O(depth) lookup enabled by the `parent_id` Dexie index.

---

## 13. MVP Scope

### 13.1 In Scope

- Project brief input and brief quality check (local LLM)
- AI-generated epics from brief (Claude Sonnet via `POST /llm/cloud`)
- Recursive decomposition: epics → tasks → leaf tasks
- Full task metadata editing via slide-out panel
- One-shot LLM field review per node (local LLM)
- One-shot LLM regeneration with instructions per node
- Dependency graph view with draw-in-graph edge creation and immediate Dexie persistence
- Stale node detection and amber badge display
- Prompt Sandbox — rendered prompt preview before LLM call
- Ancestor Path highlighting in graph canvas
- Markdown and JSON export (full graph, branch, or selection)
- Claude Code prompt generator for any task or leaf task
- Validation warnings for leaf tasks missing criteria
- List view: leaf tasks, topological sort, filter by readiness
- JSON Resilience Utility in FastAPI proxy
- Response Validation Contract with repair and rejection rules

### 13.2 Out of Scope (Phase 2)

> **⚠ Scope Cut — Execution Tracking**
> Status fields, dev notes, and test result recording are Phase 2. The MVP produces a plan and stops there.

- Execution status tracking per node
- Dev notes and test result recording
- Full-tree LLM review (export to Claude manually as substitute)
- Critical path highlighting
- Template-based task generation
- Repository-aware decomposition
- GitHub / Linear integration
- Collaborative features

---

## 14. Recommended Build Order

Each phase must be working and usable before the next begins. No LLM features until Phase 3.

### Phase 1 — Data + Graph Shell (No AI)

> **⚠ v3.1 Addition — Dexie Index Requirement**
> The Dexie schema must be declared with explicit indexes on `parent_id` and `type` (nodes table) and `source_id`, `target_id` (edges table) from the very first commit. Retrofitting indexes later requires a Dexie version migration and risks data loss if handled incorrectly. Get it right in Phase 1.

1. Dexie schema — nodes and edges tables with all fields, correct indexes, timestamps (see §11.2 for exact declaration)
2. React Flow canvas — static node rendering, Dagre auto-layout
3. Node edit panel — all metadata fields, Radix/Shadcn components
4. Manual dependency editing — draw edges with `onConnect` Dexie persistence
5. Ancestor Path highlighting — pure `parent_id` traversal, no AI dependency
6. Stale node detection — timestamp comparison logic, amber badge display
7. List view — `db.nodes.where('type').equals('leaf_task')` query, topological sort

**Milestone:** Full task graph buildable manually. Indexes in place. Staleness detection and ancestor highlighting working.

### Phase 2 — Export + Prompt Generation

1. Markdown export — full graph, branch, selection
2. JSON export — schema-matching serialization including timestamps
3. Prompt renderer — `renderPrompt(node, ancestorChain)` pure function
4. Claude Code prompt generator — template from node + ancestor chain
5. Prompt Sandbox UI — wraps the prompt renderer, displays rendered output, adds Send button

**Milestone:** Full manual workflow usable end-to-end. Prompt Sandbox visible and showing rendered prompts before any LLM wiring.

### Phase 3 — LLM Integration

Write and test all six prompts manually before building any of Phase 3.

1. `utils/json_cleaner.py` — JSON Resilience Utility, unit tested in isolation
2. `utils/node_validator.py` — Response Validation Contract, unit tested in isolation
3. FastAPI proxy — `POST /llm/local` and `POST /llm/cloud`, utilities wired in, `start.sh` script
4. Brief quality check — first AI feature, easiest to validate
5. Epic generation from brief
6. Task generation from epic (Golden Prompt pattern)
7. Leaf task generation from task
8. Per-node one-shot field review
9. Per-node one-shot regeneration with instructions

**Milestone:** Full AI-assisted decomposition workflow. JSON cleaned and validated server-side before any node hits Dexie.

### Phase 4 — Polish + Quality

1. Validation warnings for missing leaf task criteria
2. Sizing heuristic display and flagging
3. Keyboard shortcuts
4. Error handling and Ollama fallback states (`HTTP 503` → user-facing message)

---

## 15. Claude Code Confidence Assessment

| Component | Confidence | Notes |
|-----------|------------|-------|
| Dexie schema + indexes + timestamps | High | Exact schema defined in §11.2 |
| React Flow graph view | High | Mature library, prior art in VDE |
| Node edit panel (Shadcn) | High | Standard form patterns |
| MD + JSON export | High | Straightforward serialization |
| Prompt renderer (pure function) | High | No external deps, fully testable |
| Claude Code prompt generator | High | String templating |
| `json_cleaner.py` utility | High | Simple regex + json.loads, self-contained |
| `node_validator.py` utility | High | Explicit rules fully defined in spec |
| FastAPI proxy (two endpoints) | High | Simple POST/response, ~80 lines |
| Stale node detection logic | High | Simple timestamp comparison |
| Ancestor path computation | High | O(depth) parent_id traversal, indexed |
| `onConnect` Dexie persistence | High | Explicit constraint defined in spec |
| Prompt Sandbox UI | Medium | Depends on prompt renderer being built first |
| Ancestor Path highlighting (RF) | Medium | Conditional styling in React Flow nodes |
| Dependency edge draw + type popover | Medium | Custom React Flow handles need iteration |
| LLM decomposition + tree insertion | Medium | Output parsing + tree logic; mitigated by validator |
| One-shot node review | Medium | Prompt output format needs upfront design |

---

## 16. Third-Party Dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| React Flow | Graph visualization and edge editing | Low — mature, well-documented |
| Dexie.js | Local IndexedDB ORM | Low — stable, simple API |
| Dagre.js | Automatic graph layout | Low — standard library |
| Radix / Shadcn | Edit panel UI components | Low — headless, composable |
| FastAPI | Local LLM proxy backend | Low — trivial to run locally |
| Ollama | Local LLM inference (Qwen) | Medium — must be running; graceful fallback required |
| Anthropic API | Cloud LLM for decomposition tasks | Low — stable API, small cost at personal use scale |

> **ℹ Ollama Fallback Requirement**
> If Ollama is not running, all `POST /llm/local` calls must fail with HTTP 503 and a clear message. The React app displays: "Local LLM unavailable — start Ollama and try again." Cloud API features must remain functional independently.

---

## 17. Privacy & Data

- All project data stored locally in IndexedDB — no server, no sync.
- No user accounts or authentication needed (localhost only).
- Project briefs and task content sent to the Anthropic API leave the machine — do not include confidential client information.
- Ollama inference is fully local — no data egress.
- Anthropic API key stored in a local `.env` file, never bundled into the React frontend.

---

## 18. Open Questions (Deferred)

- Best heuristic for "Claude Code sized" tasks — validate empirically after first real project.
- How much repository context to ingest automatically (Phase 2).
- Whether to allow multiple decomposition strategies for the same project.
- How to rank tasks by readiness or risk in the list view.
- Whether critical path highlighting is worth the graph traversal complexity.

---

## 19. Acceptance Criteria

MVP is complete when all of the following are true:

- A user can enter a project goal and receive a structured task graph via AI decomposition.
- Every node write updates `updated_at`. Every decomposition sets `last_decomposed_at` on the parent.
- Child nodes are flagged Potentially Stale when parent `updated_at` drift is detected.
- The Dexie `nodes` table is indexed on `parent_id` and `type`. The `edges` table is indexed on `source_id` and `target_id`.
- All LLM responses pass through `json_cleaner.py` before parsing.
- All node arrays pass through `node_validator.py` before any Dexie write. Rejection returns HTTP 422 with a structured error. The React app displays rejection errors in the Prompt Sandbox.
- A user can decompose any node into smaller nodes via one-click LLM trigger.
- Each leaf task contains prerequisites, tests, validation commands, and success criteria.
- The system warns when a leaf task is missing validation criteria.
- Dependency edges are persisted to Dexie immediately on draw via `onConnect`.
- The Prompt Sandbox renders the full system + user prompt (with ancestor chain) before any LLM call.
- Selecting a node highlights its ancestor path in the graph canvas.
- The FastAPI proxy exposes exactly `POST /llm/local` and `POST /llm/cloud` with the defined payload contract.
- The graph can be exported as Markdown and JSON.
- A Claude Code prompt can be generated for any task or leaf task.
- The app starts with a single `start.sh` command.

---

*— End of Specification v3.1 —*
