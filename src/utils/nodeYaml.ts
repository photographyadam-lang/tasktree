import * as yaml from 'js-yaml';
import type { TaskNode } from '../types';
import type { NodeReviewReport } from '../types/review';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class YamlImportError extends Error {
  field?: string;
  hint: string;

  constructor(message: string, hint: string, field?: string) {
    super(message);
    this.name = 'YamlImportError';
    this.hint = hint;
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// Export: node → YAML string
// ---------------------------------------------------------------------------

/**
 * Serialise a TaskNode to a human-readable YAML string.
 * All fields are included; managed fields are clearly labelled.
 */
export function nodeToYaml(node: TaskNode): string {
  // lineWidth: -1 disables all folding so long scalar values can never bleed
  // into what looks like a subsequent top-level key on the same logical line.
  const DUMP_OPTS: yaml.DumpOptions = {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
  };

  // Each section is dumped as its own mini-object so key order is predictable
  // and yaml.dump never has a chance to fold one field's value into another.
  const scalarSection = yaml.dump({
    id: node.id,
    type: node.type,
    parent_id: node.parent_id,
    title: node.title,
    summary: node.summary ?? '',
    objective: node.objective ?? '',
    risk: node.risk,
    size: node.size,
    notes: node.notes ?? '',
  }, DUMP_OPTS);

  const arraySection = yaml.dump({
    scope: node.scope ?? [],
    out_of_scope: node.out_of_scope ?? [],
    prerequisites: node.prerequisites ?? [],
    depends_on: node.depends_on ?? [],
    success_criteria: node.success_criteria ?? [],
    tests: node.tests ?? [],
    validation_commands: node.validation_commands ?? [],
  }, DUMP_OPTS);

  const tsSection = yaml.dump({
    created_at: node.created_at,
    updated_at: node.updated_at,
    last_decomposed_at: node.last_decomposed_at,
  }, DUMP_OPTS);

  // architecture always present — empty mapping when absent/null
  const archDoc = (node.architecture && typeof node.architecture === 'object')
    ? node.architecture
    : {};
  const archSection = 'architecture:\n' +
    yaml.dump(archDoc, { ...DUMP_OPTS, indent: 2 })
      .split('\n')
      .map(l => l ? '  ' + l : l)
      .join('\n');

  const reviewSection = node.last_review
    ? yaml.dump({ last_review: node.last_review }, DUMP_OPTS)
    : '';

  return (
    '# Task Graph Builder — Node Export\n' +
    '# Fields: id, type, parent_id, created_at, updated_at, last_decomposed_at\n' +
    '# are managed automatically and will be preserved from the current node on import.\n\n' +
    scalarSection +
    arraySection +
    tsSection +
    archSection + '\n' +
    reviewSection
  );
}

// ---------------------------------------------------------------------------
// Import: YAML string → validated TaskNode
// ---------------------------------------------------------------------------

const VALID_RISKS = new Set(['low', 'medium', 'high']);
const VALID_SIZES = new Set(['x-small', 'small', 'medium', 'large', 'x-large']);
const VALID_TYPES = new Set(['project', 'epic', 'task', 'leaf_task']);
const ARRAY_FIELDS = [
  'scope', 'out_of_scope', 'prerequisites', 'depends_on',
  'success_criteria', 'tests', 'validation_commands',
] as const;

function requireString(obj: Record<string, unknown>, field: string): string {
  const val = obj[field];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new YamlImportError(
      `Missing required field "${field}"`,
      `The "${field}" field must be a non-empty string.`,
      field,
    );
  }
  return val.trim();
}

function coerceArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/**
 * Parse a YAML string, validate it, and merge with the current node.
 * Managed fields (id, parent_id, timestamps) are always taken from currentNode.
 * last_review is always nulled out on import (forces a fresh review cycle).
 * Throws YamlImportError on any validation failure.
 */
export function yamlToNode(raw: string, currentNode: TaskNode): TaskNode {
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new YamlImportError(
      'Invalid YAML syntax',
      `Could not parse the file as YAML. Parser said: ${msg}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new YamlImportError(
      'YAML must be a mapping object',
      'The top-level YAML value must be a plain object (mapping), not a list or scalar.',
    );
  }

  const obj = parsed as Record<string, unknown>;

  // ── Type check (must match current node) ──
  const importedType = obj.type ? String(obj.type) : '';
  if (!VALID_TYPES.has(importedType)) {
    throw new YamlImportError(
      `Unknown node type "${importedType}"`,
      `Valid types are: ${[...VALID_TYPES].join(', ')}.`,
      'type',
    );
  }
  if (importedType !== currentNode.type) {
    throw new YamlImportError(
      `Type mismatch: cannot import a "${importedType}" spec into a "${currentNode.type}" node`,
      `The YAML "type" field must be "${currentNode.type}" to match the current node.`,
      'type',
    );
  }

  // ── Required string fields ──
  const title = requireString(obj, 'title');
  const summary = requireString(obj, 'summary');
  const objective = requireString(obj, 'objective');

  // ── Enum fields ──
  const risk = obj.risk ? String(obj.risk) : '';
  if (!VALID_RISKS.has(risk)) {
    throw new YamlImportError(
      `Invalid risk value "${risk}"`,
      `"risk" must be one of: ${[...VALID_RISKS].join(', ')}.`,
      'risk',
    );
  }

  const size = obj.size ? String(obj.size) : '';
  if (!VALID_SIZES.has(size)) {
    throw new YamlImportError(
      `Invalid size value "${size}"`,
      `"size" must be one of: ${[...VALID_SIZES].join(', ')}.`,
      'size',
    );
  }

  // ── Array fields ──
  const arrays = Object.fromEntries(
    ARRAY_FIELDS.map(f => [f, coerceArray(obj[f])])
  ) as Record<typeof ARRAY_FIELDS[number], string[]>;

  // ── Optional string ──
  const notes = typeof obj.notes === 'string' ? obj.notes : '';

  // ── Architecture (optional) ──
  const architecture = (obj.architecture && typeof obj.architecture === 'object' && !Array.isArray(obj.architecture))
    ? obj.architecture as TaskNode['architecture']
    : currentNode.architecture;

  // ── Build merged node — managed fields always from currentNode ──
  return {
    ...currentNode,
    title,
    summary,
    objective,
    risk: risk as TaskNode['risk'],
    size: size as TaskNode['size'],
    notes,
    ...arrays,
    architecture,
    // Managed fields — always preserved from currentNode
    id: currentNode.id,
    type: currentNode.type,
    parent_id: currentNode.parent_id,
    created_at: currentNode.created_at,
    updated_at: new Date().toISOString(),
    last_decomposed_at: currentNode.last_decomposed_at,
    // Force fresh review after any import
    last_review: null,
  };
}

// ---------------------------------------------------------------------------
// Export-with-Prompt: LLM coaching prompt
// ---------------------------------------------------------------------------

function formatReviewSection(review: NodeReviewReport | null | undefined): string {
  if (!review || review.passed) {
    return 'No review feedback recorded yet (or the node has already passed review).';
  }
  const lines: string[] = [`Readiness: ${review.readiness.toUpperCase()}`];
  for (const issue of review.issues) {
    lines.push(`- [${issue.severity}] ${issue.field}: ${issue.problem}`);
    lines.push(`  Suggestion: ${issue.suggestion}`);
  }
  return lines.join('\n');
}

/**
 * Produces a coaching prompt intended to be pasted into an LLM chat.
 * The LLM will ask clarifying questions and eventually emit an
 * ---IMPORT-START--- / ---IMPORT-END--- block that the user can import.
 */
export function buildExportWithPrompt(node: TaskNode): string {
  const nodeYaml = nodeToYaml(node);
  const reviewSection = formatReviewSection(node.last_review);

  return `=======================================================
TASK GRAPH BUILDER — NODE COACHING SESSION
=======================================================

You are an expert software architect helping a developer
refine the following task specification. Your goal is to
ask targeted, clarifying questions to fill in any gaps
that would prevent an AI coding agent from safely
implementing this task without ambiguity.

--- CURRENT NODE SPECIFICATION (YAML) ---

${nodeYaml}

--- REVIEW FEEDBACK ---

${reviewSection}

--- YOUR INSTRUCTIONS ---

1. Read the node specification above carefully.
2. Focus on the review feedback issues (if any) first,
   then identify any remaining gaps that would cause an
   AI coding agent to produce incorrect, incomplete, or
   out-of-scope output.
3. Ask the developer ONE focused question at a time.
4. After each answer, silently update your working version
   of the specification.
5. When you believe all gaps are resolved — and only then —
   output the updated specification in EXACTLY this format
   and nothing else after it:

---IMPORT-START---
<valid YAML of the full updated node spec>
---IMPORT-END---

---
YAML FORMATTING RULES (apply to the final output only):
- summary: 3–5 sentences maximum. Plain prose only. No markdown headers, tables, or code blocks inside this field. High-level description only.
- All detail belongs in the structured fields (scope, out_of_scope, success_criteria, tests, architecture, etc.), not in summary or notes.
- Each item in a list field (scope, out_of_scope, prerequisites, success_criteria, tests, validation_commands) must be a single line under 120 characters.
- notes: 2–3 sentences maximum. Implementation reminders only.
- Use plain block scalar style (|) only when a value genuinely requires internal line breaks. Use a plain unquoted string for all single-sentence values.
- Do not put markdown syntax (##, **, \`\`\`, or pipe tables) inside any YAML field value.
- architecture sub-fields must be single unquoted strings, one line each.
- If a top-level field name (e.g. scope:, tests:, created_at:, architecture:) appears as inline text inside another field's value in the input spec, extract it and restore it as a proper top-level YAML field in the output. Never reproduce top-level field names as inline text content.
---

Rules for the YAML you output:
- Preserve these fields exactly from the input: type, id,
  parent_id, created_at, updated_at, last_decomposed_at.
- The "type" field MUST remain "${node.type}".
- Do not add any fields that are not in the original spec.
- All array fields (scope, out_of_scope, prerequisites, etc.)
  must be YAML lists, not comma-separated strings.
- The developer will copy the block between ---IMPORT-START---
  and ---IMPORT-END--- into a .yaml file and import it back
  into Task Graph Builder.

Begin by introducing yourself and asking your first question.

=======================================================
`;
}
