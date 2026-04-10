import { describe, it, expect } from 'vitest';
import { renderClaudeCodePrompt } from './renderClaudeCodePrompt';
import type { TaskNode } from '../types';

function makeNode(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: 'node-1',
    title: 'Setup cookie auth',
    type: 'leaf_task',
    parent_id: 'parent-1',
    summary: 'Implements HttpOnly cookie session auth using existing middleware.',
    objective: 'Implement HttpOnly cookie-based session persistence using the existing auth middleware.',
    scope: ['src/auth', 'src/middleware'],
    out_of_scope: ['UI changes', 'Database migrations'],
    prerequisites: ['Auth middleware exists', 'Session table created'],
    depends_on: [],
    success_criteria: ['User remains signed in after page refresh.', 'Session expires after 24h.'],
    tests: ['npm test'],
    validation_commands: ['npm test', 'npm run lint'],
    risk: 'medium',
    size: 'small',
    notes: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_decomposed_at: null,
    ...overrides,
  };
}

function makeAncestor(type: TaskNode['type'], title: string, summary: string): TaskNode {
  return makeNode({ id: `anc-${type}`, type, title, summary, parent_id: '' });
}

const ARCH_CTX = '## Architecture Context\nStack: React 19 + TypeScript\nRules: Stay in scope.';

describe('renderClaudeCodePrompt', () => {
  it('produces a full prompt with all sections when given full data and architecture context', () => {
    const ancestors = [
      makeAncestor('project', 'Task Graph Builder', 'A visual task decomposition tool.'),
      makeAncestor('epic', 'Auth Epic', 'All authentication features.'),
    ];
    const result = renderClaudeCodePrompt(makeNode(), ancestors, ARCH_CTX);

    expect(result).toContain('## Project Context');
    expect(result).toContain(ARCH_CTX);
    expect(result).toContain('## Task: Setup cookie auth');
    expect(result).toContain('**Objective:**');
    expect(result).toContain('**Scope:**');
    expect(result).toContain('- src/auth');
    expect(result).toContain('**Out of Scope:**');
    expect(result).toContain('- UI changes');
    expect(result).toContain('## Why This Exists');
    expect(result).toContain('**project:** Task Graph Builder');
    expect(result).toContain('**epic:** Auth Epic');
    expect(result).toContain('## Before You Start');
    expect(result).toContain('**Prerequisites:**');
    expect(result).toContain('## Done When');
    expect(result).toContain('**Success Criteria:**');
    expect(result).toContain('**Run These to Verify:**');
    expect(result).toContain('npm run lint');
    expect(result).toContain('## Rules');
  });

  it('omits the Project Context section when architectureContext is empty', () => {
    const result = renderClaudeCodePrompt(makeNode(), [], '');
    expect(result).not.toContain('## Project Context');
    expect(result).toContain('## Task:');
  });

  it('omits Scope when node.scope is empty', () => {
    const result = renderClaudeCodePrompt(makeNode({ scope: [] }), [], ARCH_CTX);
    expect(result).not.toContain('**Scope:**');
    expect(result).toContain('**Objective:**');
  });

  it('omits Why This Exists when ancestorChain is empty', () => {
    const result = renderClaudeCodePrompt(makeNode(), [], ARCH_CTX);
    expect(result).not.toContain('## Why This Exists');
  });

  it('shows [none defined] in the verify block when validation_commands is empty', () => {
    const result = renderClaudeCodePrompt(makeNode({ validation_commands: [] }), [], '');
    expect(result).toContain('**Run These to Verify:**');
    expect(result).toContain('[none defined]');
  });

  it('renders without error for a project node', () => {
    const projectNode = makeNode({
      type: 'project',
      parent_id: '',
      scope: [],
      out_of_scope: [],
      prerequisites: [],
      depends_on: [],
    });
    expect(() => renderClaudeCodePrompt(projectNode, [], '')).not.toThrow();
    const result = renderClaudeCodePrompt(projectNode, [], '');
    expect(result).toContain('## Task:');
    expect(result).toContain('## Rules');
  });
});
