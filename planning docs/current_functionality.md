# Current Functionality: Task Graph Builder

This document outlines the high-level architecture, testing processes, and existing product features of the Task Graph Builder application.

## High-Level Architecture

The platform operates on a locally-first, full-stack architecture separated into a fast Vite-powered frontend and a Python-powered backend serving external systems and LLMs.

### Frontend
- **Framework & Build:** React 19, TypeScript, built with Vite.
- **Styling:** TailwindCSS v4 and Radix UI headless components for accessible, rapid UI development.
- **Canvas/Graph Engine:** `reactflow` layered with `dagre` for automated topological layouts. 
- **Persistence Layer:** `dexie` acting as a wrapper around IndexedDB, allowing an exclusively local-first, privacy-focused offline persistence model.
- **State Management:** Handled largely via React state, Dexie LiveQueries, and standard React contexts.

### Backend
- **Framework:** FastAPI (Python) running on Uvicorn.
- **LLM Integration Layer:** Serves endpoints (`/llm/local` and `/llm/cloud`) acting as proxies to interface reliably with locally running Ollama instances as well as Anthropic's Claude APIs.
- **System Telemetry:** Integrated `psutil` library to assess available RAM to intelligently surface eligible local Ollama models.
- **Validation Engine:** Built-in JSON sanitization and fallback mapping logic ensuring LLM responses correctly coerce into valid node structures for the frontend.

---

## Testing Process

The repository champions robust, multifaceted testing strategies:

1. **Unit & Integration Tests (Frontend):** 
   - Powered by `vitest` mapping tightly with `@testing-library/react`.
   - Executable via `npm run test` and a provided UI runner via `npm run test:ui`.

2. **End-to-End Testing (E2E):**
   - Driven entirely by Playwright (`@playwright/test`).
   - Asserts true interaction pipelines (e.g., verifying canvas loading, topological sorting rendering correctly, asserting node editing panel features functioning, and mocking database flows).
   - E2E tests purge the IndexedDB schemas before and during suites to assure true isolated behaviors.
   - Executable via `npm run test:e2e`.

3. **Static Analysis & Linting:**
   - Enforced by ESLint with strong TypeScript typing analysis and rules specifically handling React best practices.
   - Executable via `npm run lint`.

---

## Current Product Features

The current iteration of the system provides the following robust features:

- **Local-First Persistence:** No remote database requirement. Task structures and user data exist persistently and robustly on the local browser via IndexedDB.
- **Hierarchical Diagramming (Graph Canvas):** Dynamic, visual mapping of task flow topologies starting at Project roots down to Epics, Tasks, and leaf nodes, powered organically by React Flow.
- **Intelligent LLM Task Decomposition:** Users can "decompose" larger parent tasks into logical child components by routing prompts via to either:
  - Local LLMs via an Ollama proxy integration, assessing hardware suitability gracefully.
  - Powerful Cloud capabilities utilizing Anthropic models (like `claude-3-5-sonnet-20241022`).
- **RAM-Aware Model Selector:** An integrated endpoint evaluates the system's available memory, automatically gating Out-of-Memory failures before local models run.
- **Data Export Pipelines:** Quick actions exposed to effortlessly dump current database snapshots to JSON or elegantly formatted Markdown files.
- **Leaf Task Topology View:** Transitions from a visual graph interface into an execution-oriented "List View" ordering bottom-level actionable task execution linearly.
- **Node Property Control Sandbox:** Interactive property sheet panel allowing tuning metrics like specific node task Risk, Objective summaries, specific scoping, and dependency linking mappings.
