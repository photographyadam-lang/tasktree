import { z } from 'zod';

const ReviewIssueSchema = z.object({
  field: z.string(),
  severity: z.enum(['blocking', 'refine']),
  problem: z.string(),
  suggestion: z.string(),
});

export const ReviewReportSchema = z.object({
  passed: z.boolean(),
  readiness: z.enum(['green', 'amber', 'red']),
  issues: z.array(ReviewIssueSchema),
});
