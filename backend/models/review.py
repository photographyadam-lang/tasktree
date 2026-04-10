from typing import List, Literal
from pydantic import BaseModel


class ReviewIssue(BaseModel):
    field: str
    severity: Literal['blocking', 'refine']
    problem: str
    suggestion: str


class NodeReviewReport(BaseModel):
    passed: bool
    readiness: Literal['green', 'amber', 'red']
    issues: List[ReviewIssue]
