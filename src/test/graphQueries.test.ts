import { describe, it, expect } from 'vitest';
import { isChildStale } from '../utils/graphQueries';
import type { TaskNode } from '../types';

describe('Graph Queries (Staleness detection)', () => {
  
  const baseNode: TaskNode = {
    id: 'C1',
    parent_id: 'P1',
    type: 'task',
    title: 'X',
    summary: 'Y',
    objective: '',
    scope: [],
    out_of_scope: [],
    prerequisites: [],
    depends_on: [],
    success_criteria: [],
    tests: [],
    validation_commands: [],
    size: 'small',
    risk: 'low',
    notes: '',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    last_decomposed_at: null
  };

  it('returns false if parent is strictly cleanly older than child', () => {
    const parent = { ...baseNode, id: 'P1', updated_at: '2026-01-01T08:00:00Z' };
    const child = { ...baseNode, created_at: '2026-01-01T10:00:00Z' };

    expect(isChildStale(parent, child)).toBe(false);
  });

  it('returns true if parent updated_at advances past child creation', () => {
    const parent = { ...baseNode, id: 'P1', updated_at: '2026-01-01T12:00:00Z' };
    const child = { ...baseNode, created_at: '2026-01-01T10:00:00Z', last_decomposed_at: null };

    // Parent modified after child was established
    expect(isChildStale(parent, child)).toBe(true);
  });
});
