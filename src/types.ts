export interface TaskNode {
  id: string;
  title: string;
  type: 'project' | 'epic' | 'task' | 'leaf_task';
  parent_id: string;
  summary: string;
  objective: string;
  scope: string[];
  out_of_scope: string[];
  prerequisites: string[];
  depends_on: string[];
  success_criteria: string[];
  tests: string[];
  validation_commands: string[];
  risk: 'low' | 'medium' | 'high';
  size: 'x-small' | 'small' | 'medium' | 'large' | 'x-large';
  notes: string;
  created_at: string;
  updated_at: string;
  last_decomposed_at: string | null;
}

export interface TaskEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: 'depends_on' | 'blocks' | 'related_to';
}
