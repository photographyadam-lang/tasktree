from typing import List, Optional
from pydantic import BaseModel


class RegenResponse(BaseModel):
    title: Optional[str] = None
    objective: Optional[str] = None
    summary: Optional[str] = None
    scope: Optional[List[str]] = None
    out_of_scope: Optional[List[str]] = None
    prerequisites: Optional[List[str]] = None
    success_criteria: Optional[List[str]] = None
    tests: Optional[List[str]] = None
    validation_commands: Optional[List[str]] = None
    notes: Optional[str] = None
    size: Optional[str] = None
    risk: Optional[str] = None
