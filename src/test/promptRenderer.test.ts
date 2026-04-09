import { describe, it, expect } from 'vitest';
import { renderPrompt } from '../utils/promptRenderer';
import type { TaskNode } from '../types';

describe('Prompt Renderer Utility', () => {

  const dummyNode: TaskNode = {
    id: '123',
    parent_id: '',
    type: 'project',
    title: 'Core System',
    summary: 'Build the core system',
    objective: 'MVP',
    scope: [],
    out_of_scope: [],
    prerequisites: [],
    depends_on: [],
    success_criteria: [],
    tests: [],
    validation_commands: [],
    size: 'large',
    risk: 'low',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_decomposed_at: null
  };

  it('evaluates gracefully against root nodes with no ancestors', () => {
    const prompt = renderPrompt(dummyNode, []);
    
    // Validates text matches root fallback string
    expect(prompt).toContain('(None. This is the root node.)');
    expect(prompt).not.toContain('undefined');
  });

  it('maps correct ancestor hierarchical depth', () => {
    const parentNode: TaskNode = { ...dummyNode, id: 'abc', type: 'epic', title: 'Parent Epic' };
    
    const prompt = renderPrompt(dummyNode, [parentNode]);
    
    expect(prompt).toContain('EPIC: Parent Epic');
    // Ensure node payload binds gracefully
    expect(prompt).toContain('Core System');
  });
});
