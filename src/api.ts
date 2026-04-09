import type { TaskNode } from './types';

export interface DecomposePayload {
  nodePayload: Partial<TaskNode>;
  ancestorChain: Partial<TaskNode>[];
  userPrompt: string;
}

export async function decomposeNode(payload: DecomposePayload, isLocal: boolean = false): Promise<TaskNode[]> {
  const endpoint = isLocal ? 'http://localhost:8000/llm/local' : 'http://localhost:8000/llm/cloud';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `API Request Failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.nodes;
}
