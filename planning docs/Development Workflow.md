# Development Workflow & Safety Rails

Follow this sequence for every feature added to the Task Graph Planner.

## 1. Component Isolation

Before adding a feature to the main graph, build the logic in isolation:

- **Data:** Test Dexie queries (like Ancestor traversal) in the console first.
- **UI:** Build Shadcn components in the Slide-out panel before wiring them to state.
- **AI:** Test prompts in the Anthropic Workbench or Claude.ai before adding to the `renderPrompt` function.

## 2. The "Runnable" Guard

The application must remain runnable at every step.

- Never commit a change that breaks the local `start.sh` flow.
- If Ollama is not running, the app should still function for manual graph building and Markdown exports.

## 3. Mandatory Checkpoints (v3.1 Compliance)

Ensure the following are verified during implementation:

- **Index Check:** Open IndexedDB in DevTools and verify `nodes` table has indexes on `parent_id` and `type`.
- **Timestamp Check:** Verify `updated_at` changes when any text field is edited in the panel.
- **Persistence Check:** Draw a dependency edge and refresh the page; the edge must persist instantly.
- **LLM Safety Check:** Intentionally wrap an LLM mock response in markdown fences (```json) to verify the `json_cleaner.py` utility strips them correctly.

## 4. Error Handling Protocol

- **FastAPI Errors:** Log to terminal but return structured JSON errors to the frontend (§11.6).
- **Validation Rejection:** If a node fails validation, show the specific missing field in the Prompt Sandbox UI. Do NOT partially save the node array.