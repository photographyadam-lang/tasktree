import type { TaskNode } from '../types';

export function renderClaudeCodePrompt(
  node: TaskNode,
  ancestorChain: TaskNode[],  // ordered from root to immediate parent
  architectureContext: string
): string {
  const sections: string[] = [];

  // Project Context — omit entirely if architectureContext is empty
  if (architectureContext.trim()) {
    sections.push(`## Project Context\n${architectureContext}`);
  }

  // Task section — objective always present, scope/out_of_scope omitted if empty
  const taskBodyParts: string[] = [`**Objective:** ${node.objective}`];

  if (node.scope?.length) {
    taskBodyParts.push(`**Scope:**\n${node.scope.map(s => `- ${s}`).join('\n')}`);
  }

  if (node.out_of_scope?.length) {
    taskBodyParts.push(`**Out of Scope:**\n${node.out_of_scope.map(s => `- ${s}`).join('\n')}`);
  }

  sections.push(`## Task: ${node.title}\n${taskBodyParts.join('\n\n')}`);

  // Why This Exists — omit if no ancestors
  if (ancestorChain.length > 0) {
    const lines = ancestorChain.map(a => `- **${a.type}:** ${a.title} — ${a.summary}`);
    sections.push(`## Why This Exists\n${lines.join('\n')}`);
  }

  // Before You Start — prerequisites always shown, depends_on omitted if empty
  const prereqLines = node.prerequisites?.length
    ? node.prerequisites.map(p => `- ${p}`)
    : ['[none listed]'];

  const beforeParts: string[] = [`**Prerequisites:**\n${prereqLines.join('\n')}`];

  if (node.depends_on?.length) {
    beforeParts.push(`**Depends On:** ${node.depends_on.join(', ')}`);
  }

  sections.push(`## Before You Start\n${beforeParts.join('\n\n')}`);

  // Done When
  const criteriaLines = node.success_criteria?.length
    ? node.success_criteria.map(c => `- ${c}`)
    : ['[none defined]'];

  const verifyContent = node.validation_commands?.length
    ? node.validation_commands.join('\n')
    : '[none defined]';

  sections.push(
    `## Done When\n` +
    `**Success Criteria:**\n${criteriaLines.join('\n')}\n\n` +
    `**Run These to Verify:**\n\`\`\`\n${verifyContent}\n\`\`\``
  );

  // Rules — static; user's claude_rules are already in architectureContext above
  sections.push(
    `## Rules\n` +
    `- Work only within the defined scope. Do not modify files unrelated to this task.\n` +
    `- If you hit ambiguity or a blocker, stop and surface it — do not guess.\n` +
    `- Run validation commands when done and confirm they pass before closing the task.`
  );

  return sections.join('\n\n---\n\n');
}
