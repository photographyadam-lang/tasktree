import { describe, it, expect } from 'vitest';
import { ReviewReportSchema } from './reviewSchema';

describe('ReviewReportSchema', () => {
  it('accepts a valid passing report', () => {
    const input = {
      passed: true,
      readiness: 'green',
      issues: [],
    };
    expect(() => ReviewReportSchema.parse(input)).not.toThrow();
    const result = ReviewReportSchema.parse(input);
    expect(result.passed).toBe(true);
    expect(result.readiness).toBe('green');
    expect(result.issues).toHaveLength(0);
  });

  it('accepts a valid failing report with blocking issues', () => {
    const input = {
      passed: false,
      readiness: 'red',
      issues: [
        {
          field: 'objective',
          severity: 'blocking',
          problem: 'Objective is missing',
          suggestion: 'Add a clear objective statement',
        },
      ],
    };
    expect(() => ReviewReportSchema.parse(input)).not.toThrow();
    const result = ReviewReportSchema.parse(input);
    expect(result.passed).toBe(false);
    expect(result.readiness).toBe('red');
    expect(result.issues[0].severity).toBe('blocking');
  });

  it('accepts a valid failing report with refine issues', () => {
    const input = {
      passed: false,
      readiness: 'amber',
      issues: [
        {
          field: 'scope',
          severity: 'refine',
          problem: 'Scope is vague',
          suggestion: 'Clarify which modules are in scope',
        },
      ],
    };
    expect(() => ReviewReportSchema.parse(input)).not.toThrow();
    const result = ReviewReportSchema.parse(input);
    expect(result.passed).toBe(false);
    expect(result.readiness).toBe('amber');
    expect(result.issues[0].severity).toBe('refine');
  });

  it('rejects an invalid object missing required fields', () => {
    const input = {
      readiness: 'green',
      // missing: passed, issues
    };
    expect(() => ReviewReportSchema.parse(input)).toThrow();
  });
});
