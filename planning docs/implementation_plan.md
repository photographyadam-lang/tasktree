# Enhancing Task Decomposition for LLM Handoff

I understand your core workflow now: **You will manually export the graph from this visual tool as a Markdown/JSON file, and pass it to a separate LLM (like Claude Code) which will parse it to create a `tasks.md` execution plan.** 

Our current decomposition quality is falling short of giving that downstream LLM what it needs. Here is the plan to address your 6 specific concerns based directly on the v3.1 Spec.

## 1. Node Information Density, Tests, Start & End Criteria (Concerns 1, 5, 6)
**Problem:** The nodes lack detailed information, specific tests aren't suggested, and start/end criteria are vague.
**Solution:** We need to heavily tune the Golden Prompt (`src/utils/promptRenderer.ts`).
- **MODIFY** `src/utils/promptRenderer.ts`: Update the LLM instructions to explicitly mandate:
  - `prerequisites` must define exactly what must be true before this task can **start** (e.g., specific API endpoints exist, DB schema deployed).
  - `success_criteria` must define exactly how to verify the task has **ended** successfully.
  - `tests` must suggest specific unit/integration test cases, not just generic phrases like "unit tests".
  - Summaries and objectives must be detailed and descriptive.

## 2. Tracking High-Level Objectives (Concern 2)
**Problem:** Leaf nodes lose the context of *why* they exist for the overall application.
**Solution:**
- **MODIFY** `src/utils/promptRenderer.ts`: Inject the Root Project's objective explicitly into the "Instructions" block of the prompt, forcing the LLM to contextualize the child task's `objective` field within the broader application goal.
- **MODIFY** `src/utils/exportEngine.ts`: Ensure the Markdown export includes an overarching "Project Context" block at the top so the downstream LLM sees the global objective before reading the individual tasks.

## 3. Sibling Dependencies (Concern 3)
**Problem:** Sibling nodes generated in the same batch don't establish `depends_on` relationships with each other.
**Solution:** 
- **MODIFY** `src/utils/promptRenderer.ts`: Instruct the LLM to assign explicit, readable string IDs to the objects it generates (e.g., `"id": "auth-api-1"`), and to populate the `depends_on` array using those exact IDs if one sibling requires another sibling to be finished first.
- **MODIFY** `backend/main.py`: Update the edge-generation logic in `_process_and_validate_response` or the frontend `triggerDecompose` to parse these `depends_on` strings from the LLM output and create real `db.edges` linking the siblings.

## 4. Node Quality Checks (Concern 4)
**Problem:** No way to verify if a node is written well enough prior to export.
**Solution:** Implement the **"One-Shot Node Review"** feature from Spec §9.4 and §11.4.
- **NEW BACKEND PROMPT**: Add a new prompt flag or branch in `backend/main.py` specifically for `field_review`.
- **MODIFY** `src/components/NodeEditPanel.tsx`: Add a **"Review Quality"** button (Local AI). When clicked, it passes the current node's JSON to the local LLM. The LLM acts as a strict reviewer looking for vague start/end criteria, missing test suggestions, or unclear summaries, returning a structured gap report.
- Display this gap report directly in the Edit Panel so you can manually refine the text or trigger a targeted regeneration before exporting.

---

## User Review Required

> [!IMPORTANT]
> Does this alignment of Prompt Engineering, Export Formatting, and the new Quality Review UI address the blockers for your downstream LLM handoff?
> 
> Also, regarding **Concern 3 (Dependencies)**: When exporting the Markdown, we currently group tasks by their parent. Would you also like the Markdown export to explicitly indent/list dependencies (e.g., `Depends on: Task X`), or is grouping by Epic generally sufficient for the `tasks.md` generation?
