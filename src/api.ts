import type { TaskNode } from './types';

export interface DecomposePayload {
  nodePayload: Partial<TaskNode>;
  ancestorChain: Partial<TaskNode>[];
  userPrompt: string;
  model: string;
}

export interface OllamaModel {
  name: string;
  size_gb: number;
  fits_in_ram: boolean;
}

export interface ModelsResponse {
  models: OllamaModel[];
  system_ram_available_gb: number;
  system_ram_total_gb: number;
}

export async function fetchModels(): Promise<ModelsResponse> {
  let response: Response;
  try {
    response = await fetch('http://localhost:8000/api/models');
  } catch {
    throw new Error("Backend proxy is offline — run start.bat to start the backend.");
  }
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || `Failed to fetch models (${response.status})`);
  }
  return response.json();
}

export async function decomposeNode(payload: DecomposePayload, isLocal: boolean = true): Promise<TaskNode[]> {
  const endpoint = isLocal ? 'http://localhost:8000/llm/local' : 'http://localhost:8000/llm/cloud';
  
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err: any) {
    throw new Error("Local LLM unavailable — start Ollama and the Backend Proxy and try again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `API Request Failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.nodes;
}
