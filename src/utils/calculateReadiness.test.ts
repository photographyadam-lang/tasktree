import { describe, it, expect } from 'vitest';
import { calculateReadiness } from './calculateReadiness';
import type { TaskNode } from '../types';

function makeNode(overrides: Partial<TaskNode>): TaskNode {
  return {
    id: 'test-id',
    title: 'Test Node',
    type: 'leaf_task',
    parent_id: '',
    summary: 'This is a summary with more than eight words total here.',
    objective: 'This is a clear objective with more than ten words describing what it accomplishes.',
    scope: ['frontend', 'backend'],
    out_of_scope: [],
    prerequisites: ['some prerequisite exists'],
    depends_on: [],
    success_criteria: ['User can log in and remain signed in after page refresh successfully.'],
    tests: ['npm test'],
    validation_commands: ['npm run lint'],
    risk: 'low',
    size: 'small',
    notes: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_decomposed_at: null,
    ...overrides,
  };
}

describe('calculateReadiness', () => {
  it('returns green for a fully populated leaf_task', () => {
    const result = calculateReadiness(makeNode({}));
    expect(result.passed).toBe(true);
    expect(result.readiness).toBe('green');
    expect(result.issues).toHaveLength(0);
  });

  it('returns red with blocking objective issue for a 5-word objective', () => {
    const result = calculateReadiness(makeNode({ objective: 'Too short objective here.' }));
    expect(result.passed).toBe(false);
    expect(result.readiness).toBe('red');
    const issue = result.issues.find(i => i.field === 'objective');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('blocking');
  });

  it('returns red with blocking validation issue when no validation_commands and no tests', () => {
    const result = calculateReadiness(makeNode({ validation_commands: [], tests: [] }));
    expect(result.passed).toBe(false);
    expect(result.readiness).toBe('red');
    const issue = result.issues.find(i => i.field === 'validation');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('blocking');
  });

  it('returns amber when all fields present but success_criteria are vague', () => {
    const result = calculateReadiness(makeNode({
      success_criteria: ['Done.', 'Works.'],  // all under 8 words
    }));
    expect(result.passed).toBe(false);
    expect(result.readiness).toBe('amber');
    const issue = result.issues.find(i => i.field === 'success_criteria');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('refine');
    expect(result.issues.every(i => i.severity === 'refine')).toBe(true);
  });

  it('returns green for a task node with no validation (rule skipped)', () => {
    const result = calculateReadiness(makeNode({
      type: 'task',
      validation_commands: [],
      tests: [],
    }));
    expect(result.issues.find(i => i.field === 'validation')).toBeUndefined();
    // may still be green if all other fields pass
    expect(result.readiness).toBe('green');
  });

  it('returns green for a project node with no prerequisites (rule skipped)', () => {
    const result = calculateReadiness(makeNode({
      type: 'project',
      prerequisites: [],
    }));
    expect(result.issues.find(i => i.field === 'prerequisites')).toBeUndefined();
    expect(result.readiness).toBe('green');
  });
});
