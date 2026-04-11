import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';
import { nodeToYaml, yamlToNode, buildExportWithPrompt, YamlImportError } from './nodeYaml';
import type { TaskNode } from '../types';

const BASE_NODE: TaskNode = {
  id: 'test-uuid-1',
  type: 'task',
  parent_id: 'parent-uuid',
  title: 'Implement Auth',
  summary: 'Build JWT authentication',
  objective: 'Secure the API endpoints',
  risk: 'medium',
  size: 'medium',
  notes: 'See ADR-12',
  scope: ['JWT tokens', 'refresh logic'],
  out_of_scope: ['OAuth providers'],
  prerequisites: ['Database schema'],
  depends_on: [],
  success_criteria: ['Token validates correctly'],
  tests: ['test_auth.py::test_token'],
  validation_commands: ['pytest tests/test_auth.py'],
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
  last_decomposed_at: null,
  last_review: null,
};

// ── nodeToYaml ──────────────────────────────────────────────────────────────

describe('nodeToYaml', () => {
  it('roundtrip: re-parsed keys match source node', () => {
    const yamlStr = nodeToYaml(BASE_NODE);
    // Should be valid YAML (no exception)
    expect(typeof yamlStr).toBe('string');
    // Re-parse and spot-check key fields
    const reparsed = yamlToNode(yamlStr, BASE_NODE);
    expect(reparsed.title).toBe(BASE_NODE.title);
    expect(reparsed.summary).toBe(BASE_NODE.summary);
    expect(reparsed.objective).toBe(BASE_NODE.objective);
    expect(reparsed.scope).toEqual(BASE_NODE.scope);
    expect(reparsed.risk).toBe(BASE_NODE.risk);
    expect(reparsed.size).toBe(BASE_NODE.size);
  });

  it('includes last_review in output when present', () => {
    const nodeWithReview: TaskNode = {
      ...BASE_NODE,
      last_review: {
        passed: false,
        readiness: 'red',
        issues: [{ field: 'objective', severity: 'blocking', problem: 'Too short', suggestion: 'Expand it' }],
      },
    };
    const yamlStr = nodeToYaml(nodeWithReview);
    expect(yamlStr).toContain('last_review');
    expect(yamlStr).toContain('blocking');
  });

  it('fully populated node: all top-level keys present and correctly typed after parse', () => {
    const fullNode: TaskNode = {
      ...BASE_NODE,
      summary: 'A long summary that goes on for quite a while and has many words in it to test folding behavior.',
      objective: 'We want to do something very specific here with a long objective string that might trigger folding.',
      scope: ['thing one', 'thing two'],
      out_of_scope: ['not this'],
      prerequisites: ['prereq one'],
      depends_on: ['dep one'],
      success_criteria: ['criterion one'],
      tests: ['test_foo.py'],
      validation_commands: ['npm run test'],
      architecture: {
        stack: 'React + FastAPI',
        auth_pattern: 'JWT',
        deployment_target: 'Vercel',
        key_constraints: 'local-first',
        naming_conventions: 'camelCase',
        claude_rules: 'Stay in scope',
      },
    };
    const yamlStr = nodeToYaml(fullNode);
    // Strip comment lines before parsing so js-yaml doesn't trip on them
    const stripped = yamlStr.replace(/^#.*\n/gm, '');
    const parsed = yaml.load(stripped) as Record<string, unknown>;

    // All scalar top-level keys present with correct type
    expect(typeof parsed.id).toBe('string');
    expect(typeof parsed.type).toBe('string');
    expect(typeof parsed.parent_id).toBe('string');
    expect(typeof parsed.title).toBe('string');
    expect(typeof parsed.summary).toBe('string');
    expect(typeof parsed.objective).toBe('string');
    expect(typeof parsed.risk).toBe('string');
    expect(typeof parsed.size).toBe('string');
    expect(typeof parsed.notes).toBe('string');
    expect(typeof parsed.created_at).toBe('string');
    expect(typeof parsed.updated_at).toBe('string');

    // All array fields are real arrays
    expect(Array.isArray(parsed.scope)).toBe(true);
    expect(Array.isArray(parsed.out_of_scope)).toBe(true);
    expect(Array.isArray(parsed.prerequisites)).toBe(true);
    expect(Array.isArray(parsed.depends_on)).toBe(true);
    expect(Array.isArray(parsed.success_criteria)).toBe(true);
    expect(Array.isArray(parsed.tests)).toBe(true);
    expect(Array.isArray(parsed.validation_commands)).toBe(true);

    // architecture is a mapping object, not a string or array
    expect(typeof parsed.architecture).toBe('object');
    expect(parsed.architecture).not.toBeNull();
    expect(Array.isArray(parsed.architecture)).toBe(false);

    // No top-level key name appears as inline text inside a scalar field value
    const topLevelKeys = ['scope', 'out_of_scope', 'prerequisites', 'depends_on',
      'success_criteria', 'tests', 'validation_commands', 'created_at', 'updated_at',
      'last_decomposed_at', 'architecture'];
    for (const key of topLevelKeys) {
      if (typeof parsed.summary === 'string') {
        expect(parsed.summary).not.toMatch(new RegExp(`\\b${key}:`));
      }
      if (typeof parsed.objective === 'string') {
        expect(parsed.objective).not.toMatch(new RegExp(`\\b${key}:`));
      }
    }
  });
});

// ── yamlToNode ──────────────────────────────────────────────────────────────

describe('yamlToNode', () => {
  it('happy path: valid YAML produces correct TaskNode', () => {
    const yamlStr = nodeToYaml(BASE_NODE);
    const result = yamlToNode(yamlStr, BASE_NODE);

    expect(result.title).toBe('Implement Auth');
    expect(result.id).toBe(BASE_NODE.id); // managed field preserved
    expect(result.parent_id).toBe(BASE_NODE.parent_id);
    expect(result.type).toBe('task');
    expect(result.last_review).toBeNull(); // always nulled on import
  });

  it('managed fields always taken from currentNode', () => {
    // Even if YAML has a different id/parent_id, we keep currentNode's values
    const modified = nodeToYaml(BASE_NODE).replace('test-uuid-1', 'hacked-id');
    const result = yamlToNode(modified, BASE_NODE);
    expect(result.id).toBe('test-uuid-1');
    expect(result.parent_id).toBe('parent-uuid');
  });

  it('throws YamlImportError on wrong type', () => {
    const epicNode: TaskNode = { ...BASE_NODE, type: 'epic' };
    const epicYaml = nodeToYaml(epicNode);
    // Try to import an epic YAML into a task node
    expect(() => yamlToNode(epicYaml, BASE_NODE)).toThrowError(YamlImportError);
    try {
      yamlToNode(epicYaml, BASE_NODE);
    } catch (e) {
      expect((e as YamlImportError).field).toBe('type');
      expect((e as YamlImportError).message).toContain('Type mismatch');
    }
  });

  it('throws YamlImportError on invalid risk value', () => {
    const bad = nodeToYaml(BASE_NODE).replace('risk: "medium"', 'risk: "ultra"')
      .replace("risk: medium", "risk: ultra");
    expect(() => yamlToNode(bad, BASE_NODE)).toThrowError(YamlImportError);
    try {
      yamlToNode(bad, BASE_NODE);
    } catch (e) {
      expect((e as YamlImportError).field).toBe('risk');
    }
  });

  it('throws YamlImportError on missing title', () => {
    const bad = nodeToYaml(BASE_NODE).replace(/title:.*\n/, 'title: ""\n');
    expect(() => yamlToNode(bad, BASE_NODE)).toThrowError(YamlImportError);
    try {
      yamlToNode(bad, BASE_NODE);
    } catch (e) {
      expect((e as YamlImportError).field).toBe('title');
    }
  });

  it('coerces missing array fields to empty arrays', () => {
    // Build a minimal YAML with no array fields at all
    const minYaml = `type: task\ntitle: "Min"\nsummary: "s"\nobjective: "o"\nrisk: low\nsize: small\n`;
    const result = yamlToNode(minYaml, BASE_NODE);
    expect(result.scope).toEqual([]);
    expect(result.out_of_scope).toEqual([]);
    expect(result.depends_on).toEqual([]);
  });

  it('throws on invalid YAML syntax', () => {
    expect(() => yamlToNode('{{{{bad yaml', BASE_NODE)).toThrowError(YamlImportError);
  });
});

// ── buildExportWithPrompt ───────────────────────────────────────────────────

describe('buildExportWithPrompt', () => {
  it('contains required structural markers', () => {
    const prompt = buildExportWithPrompt(BASE_NODE);
    expect(prompt).toContain('---IMPORT-START---');
    expect(prompt).toContain('---IMPORT-END---');
    expect(prompt).toContain('NODE COACHING SESSION');
  });

  it('contains YAML blob with node data', () => {
    const prompt = buildExportWithPrompt(BASE_NODE);
    expect(prompt).toContain('Implement Auth');
    expect(prompt).toContain('task');
  });

  it('includes blocking issue text when last_review has issues', () => {
    const nodeWithReview: TaskNode = {
      ...BASE_NODE,
      last_review: {
        passed: false,
        readiness: 'red',
        issues: [{ field: 'objective', severity: 'blocking', problem: 'Too vague', suggestion: 'Be specific' }],
      },
    };
    const prompt = buildExportWithPrompt(nodeWithReview);
    expect(prompt).toContain('[blocking]');
    expect(prompt).toContain('Too vague');
    expect(prompt).toContain('Be specific');
  });

  it('shows no-review message when last_review is null', () => {
    const prompt = buildExportWithPrompt(BASE_NODE);
    expect(prompt).toContain('No review feedback recorded yet');
  });
});
