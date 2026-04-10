export type IssueSeverity = 'blocking' | 'refine';

export interface ReviewIssue {
  field: string;          // the node field the issue relates to, e.g. "objective"
  severity: IssueSeverity;
  problem: string;        // plain-language description of what's wrong
  suggestion: string;     // plain-language suggested fix
}

/**
 * Report of a node review gap analysis.
 *
 * Readiness derivation:
 *   green  — passed === true, issues is empty
 *   amber  — passed === false, no blocking issues (all issues are 'refine')
 *   red    — passed === false, at least one issue has severity === 'blocking'
 */
export interface NodeReviewReport {
  passed: boolean;
  readiness: 'green' | 'amber' | 'red';
  issues: ReviewIssue[];  // empty array when passed === true
}
