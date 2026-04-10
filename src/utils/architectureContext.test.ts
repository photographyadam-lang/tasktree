import { describe, it, expect } from 'vitest';
import { getArchitectureContext } from './architectureContext';
import type { TaskNode } from '../types';

function makeProjectNode(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: 'proj-1',
    title: 'My Project',
    type: 'project',
    parent_id: '',
    summary: '',
    objective: '',
    scope: [],
    out_of_scope: [],
    prerequisites: [],
    depends_on: [],
    success_criteria: [],
    tests: [],
    validation_commands: [],
    risk: 'low',
    size: 'large',
    notes: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_decomposed_at: null,
    ...overrides,
  };
}

describe('getArchitectureContext', () => {
  it('returns the correct formatted string for a fully populated block', () => {
    const node = makeProjectNode({
      architecture: {
        stack: 'React 19 + TypeScript + FastAPI + Dexie.js',
        auth_pattern: 'HttpOnly cookie sessions, JWT',
        deployment_target: 'Vercel (frontend) + Railway (backend)',
        key_constraints: 'Local-first, no cloud DB',
        naming_conventions: 'camelCase components, snake_case Python',
        claude_rules: 'Stay in scope. Stop and ask on ambiguity.',
      },
    });
    const result = getArchitectureContext(node);
    expect(result).toBe(
      '## Architecture Context\n' +
      'Stack: React 19 + TypeScript + FastAPI + Dexie.js\n' +
      'Auth Pattern: HttpOnly cookie sessions, JWT\n' +
      'Deployment: Vercel (frontend) + Railway (backend)\n' +
      'Key Constraints: Local-first, no cloud DB\n' +
      'Naming Conventions: camelCase components, snake_case Python\n' +
      'Rules: Stay in scope. Stop and ask on ambiguity.'
    );
  });

  it('returns an empty string when architecture is undefined', () => {
    const node = makeProjectNode({ architecture: undefined });
    expect(getArchitectureContext(node)).toBe('');
  });

  it('returns an empty string when architecture is null', () => {
    const node = makeProjectNode({ architecture: null });
    expect(getArchitectureContext(node)).toBe('');
  });

  it('returns an empty string when all fields are empty', () => {
    const node = makeProjectNode({
      architecture: { stack: '', auth_pattern: '   ', deployment_target: '' },
    });
    expect(getArchitectureContext(node)).toBe('');
  });

  it('omits empty fields and includes only populated ones', () => {
    const node = makeProjectNode({
      architecture: {
        stack: 'React 19',
        claude_rules: 'Run tests before closing.',
      },
    });
    const result = getArchitectureContext(node);
    expect(result).toBe(
      '## Architecture Context\n' +
      'Stack: React 19\n' +
      'Rules: Run tests before closing.'
    );
    expect(result).not.toContain('Auth Pattern');
    expect(result).not.toContain('Deployment');
  });
});
