# Task Graph Planner Build Tasks

This task list follows the 4-phase build order specified in v3.1 of the Product Specification.

## Phase 1: Data + Graph Shell (No AI)

- [ ] **Task 1.1: Environment Scaffolding**
  - Initialize Vite + React (TS).
  - Setup Tailwind CSS and Shadcn UI.
  - Create basic layout shell with a placeholder for the Graph Canvas and the Slide-out Panel.
- [ ] **Task 1.2: Dexie Schema Implementation**
  - Implement `db.js` with `nodes` and `edges` tables.
  - **Critical:** Apply indexes to `parent_id`, `type`, `source_id`, and `target_id` exactly as per §11.2.
- [ ] **Task 1.3: React Flow Canvas & Dagre**
  - Integrate React Flow.
  - Implement top-down hierarchical layout using Dagre.js.
  - Create color-coded node components (Project, Epic, Task, Leaf Task).
- [ ] **Task 1.4: Slide-out Edit Panel**
  - Build Radix/Shadcn side panel.
  - Implement form to edit all 11 metadata fields from Section 8.
  - Ensure `updated_at` is updated on every save.
- [ ] **Task 1.5: Dependency & Ancestor Logic**
  - Implement `onConnect` with immediate Dexie persistence (§9.6).
  - Implement Ancestor Path Highlighting logic using `parent_id` traversal (§12.6).
  - Implement Stale Node Detection logic based on timestamps (§11.2).

## Phase 2: Export + Prompt Generation

- [ ] **Task 2.1: Export Engine**
  - Implement Markdown export for full graph and selected branches.
  - Implement JSON export (direct Dexie serialization).
- [ ] **Task 2.2: Prompt Rendering Engine**
  - Build `renderPrompt(node, ancestorChain)` pure function.
  - Implement "Prompt Sandbox" UI to preview rendered prompts (§12.5).
- [ ] **Task 2.3: Claude Code Prompt Generator**
  - Implement template for generating task-specific execution prompts for Claude Code.

## Phase 3: LLM Integration

- [ ] **Task 3.1: FastAPI Proxy Base**
  - Create FastAPI app with `POST /llm/local` and `POST /llm/cloud`.
  - Implement `.env` Startup Guard to validate `ANTHROPIC_API_KEY` (§11).
  - Create `start.sh` to run both Vite and FastAPI.
- [ ] **Task 3.2: LLM Safety Utilities**
  - Implement `json_cleaner.py` to strip markdown fences (§11.3).
  - Implement `node_validator.py` with repair/rejection rules (§11.6).
- [ ] **Task 3.3: AI Decomposition Flows**
  - Wire "Make Epics", "Make Tasks", and "Make Leaf Tasks" buttons.
  - Implement "Brief Quality Check" via Ollama.
  - Implement "One-Shot Node Review" and "Regenerate" actions.

## Phase 4: Polish + Quality

- [ ] **Task 4.1: UI Indicators & Warnings**
  - Add amber badges for "Potentially Stale" nodes.
  - Add warnings for leaf tasks missing validation commands.
- [ ] **Task 4.2: Keyboard Shortcuts & UX**
  - Implement shortcuts defined in §12.4.
  - Implement error handling for Ollama 503 states.