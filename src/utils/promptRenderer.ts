import type { TaskNode } from '../types';

export function renderPrompt(node: TaskNode, ancestors: TaskNode[]): string {
  // §11.5 Golden Prompt structured rendering
  // The prompt must protect ancestor chain evaluation, particularly handling root arrays gracefully.

  const ancestorText = ancestors.length === 0 
    ? "  (None. This is the root node.)" 
    : ancestors.map(a => `  - ${a.type.toUpperCase()}: ${a.title} (${a.objective})`).join('\n');

  // Strip non-essential UI meta from node before injecting to Prompt Context
  const payloadNode = {
    id: node.id,
    title: node.title,
    type: node.type,
    summary: node.summary,
    objective: node.objective,
    scope: node.scope,
    out_of_scope: node.out_of_scope,
    prerequisites: node.prerequisites,
    validation_commands: node.validation_commands
  };

  const systemPrompt = `You are a Senior Technical Architect with deep experience decomposing software projects into well-scoped, agent-executable tasks.
Output Rules:
- Return ONLY a valid JSON array. No preamble, no explanation, no markdown fences.
- Every object in the array must strictly conform to the Task Schema.
- Preferences: functional boundaries, single primary goals, minimum one validation command.`;

  const userPrompt = `Project Ancestor Path Context:
${ancestorText}

Node to Process:
${JSON.stringify(payloadNode, null, 2)}

Instructions:
Decompose this node logically, ensuring respect for scope boundaries of parents. Set parent_id to "${node.id}".`;

  return `### SYSTEM ##\n${systemPrompt}\n\n### USER ##\n${userPrompt}`;
}
