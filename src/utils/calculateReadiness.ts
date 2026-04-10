import type { TaskNode } from '../types';
import type { NodeReviewReport, ReviewIssue } from '../types/review';

const RULES = {
  objective_missing:   { problem: "Objective is missing or too short to be unambiguous.", suggestion: "Write a single clear sentence describing exactly what this task accomplishes." },
  validation_missing:  { problem: "No validation commands or tests defined.", suggestion: "Add at least one validation_command (e.g. npm test, npm run lint) or a test description." },
  criteria_vague:      { problem: "Success criteria are missing or too vague to verify.", suggestion: "Write at least one criterion that can be checked with a yes/no — e.g. 'User remains signed in after page refresh.'" },
  prerequisites_empty: { problem: "No prerequisites listed.", suggestion: "List what must already exist before this task can start." },
  scope_empty:         { problem: "Scope is empty.", suggestion: "List the specific areas, files, or concerns this task covers." },
  summary_short:       { problem: "Summary is too short to provide useful context.", suggestion: "Write a sentence or two describing what this task is and why it exists." },
};

function wordCount(str: string | undefined | null): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function calculateReadiness(node: TaskNode): NodeReviewReport {
  const issues: ReviewIssue[] = [];

  // BLOCKING: objective missing or fewer than 10 words
  if (wordCount(node.objective) < 10) {
    issues.push({ field: 'objective', severity: 'blocking', ...RULES.objective_missing });
  }

  // BLOCKING: validation missing (leaf_task only)
  if (node.type === 'leaf_task') {
    const hasCommands = Array.isArray(node.validation_commands) && node.validation_commands.length > 0;
    const hasTests = Array.isArray(node.tests) && node.tests.length > 0;
    if (!hasCommands && !hasTests) {
      issues.push({ field: 'validation', severity: 'blocking', ...RULES.validation_missing });
    }
  }

  // REFINE: success_criteria missing, empty, or all items under 8 words
  const criteria = Array.isArray(node.success_criteria) ? node.success_criteria : [];
  if (criteria.length === 0 || criteria.every(c => wordCount(c) < 8)) {
    issues.push({ field: 'success_criteria', severity: 'refine', ...RULES.criteria_vague });
  }

  // REFINE: prerequisites empty (task and leaf_task only)
  if (node.type === 'task' || node.type === 'leaf_task') {
    const prereqs = Array.isArray(node.prerequisites) ? node.prerequisites : [];
    if (prereqs.length === 0) {
      issues.push({ field: 'prerequisites', severity: 'refine', ...RULES.prerequisites_empty });
    }
  }

  // REFINE: scope empty
  const scope = Array.isArray(node.scope) ? node.scope : [];
  if (scope.length === 0) {
    issues.push({ field: 'scope', severity: 'refine', ...RULES.scope_empty });
  }

  // REFINE: summary fewer than 8 words
  if (wordCount(node.summary) < 8) {
    issues.push({ field: 'summary', severity: 'refine', ...RULES.summary_short });
  }

  if (issues.length === 0) {
    return { passed: true, readiness: 'green', issues: [] };
  }

  const hasBlocking = issues.some(i => i.severity === 'blocking');
  return {
    passed: false,
    readiness: hasBlocking ? 'red' : 'amber',
    issues,
  };
}
