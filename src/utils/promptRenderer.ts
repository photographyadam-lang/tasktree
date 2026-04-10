import type { TaskNode } from '../types';

// §11.6 Hierarchy contract: each node type may only decompose into one specific child type
const CHILD_TYPE_MAP: Record<string, string> = {
  project: 'epic',
  epic: 'task',
  task: 'leaf_task',
  leaf_task: 'leaf_task', // leaf_task cannot decompose further — should not reach here
};

export function renderPrompt(node: TaskNode, ancestors: TaskNode[]): string {
  // §11.5 Golden Prompt structured rendering
  const childType = CHILD_TYPE_MAP[node.type] ?? 'task';

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
- CRITICAL: Every object in the array MUST have "type": "${childType}". Do not use any other type value.
- Preferences: functional boundaries, single primary goals, minimum one validation command.`;

  const userPrompt = `Project Ancestor Path Context:
${ancestorText}

Node to Decompose (type: ${node.type.toUpperCase()}):
${JSON.stringify(payloadNode, null, 2)}

Instructions:
Decompose this ${node.type} into ${childType}s ONLY. Every item in your JSON array must have "type": "${childType}".
Do NOT produce tasks, leaf_tasks, or any other type — only "${childType}".
Set parent_id to "${node.id}" on every item.`;

  return `### SYSTEM ##\n${systemPrompt}\n\n### USER ##\n${userPrompt}`;
}
