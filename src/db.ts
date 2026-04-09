import Dexie, { type EntityTable } from 'dexie';
import type { TaskNode, TaskEdge } from './types';

const db = new Dexie('TaskGraphPlanner') as Dexie & {
  nodes: EntityTable<TaskNode, 'id'>,
  edges: EntityTable<TaskEdge, 'id'>
};

// Strict Indexing Requirements (§11.2 of spec)
db.version(1).stores({
  nodes: 'id, parent_id, type',
  edges: 'id, source_id, target_id',
});

// Wrapper to enforce timestamps on every node write
export async function putNode(node: Partial<TaskNode> & { id: string, title: string, type: TaskNode['type'] }) {
  const now = new Date().toISOString();
  
  // Try to get existing node if it exists
  const existing = await db.nodes.get(node.id).catch(() => null);
  
  const isCreated = !existing;
  
  const updatedNode = {
    ...node,
    created_at: existing?.created_at || now,
    updated_at: now,
  } as TaskNode;

  if (isCreated) {
    updatedNode.last_decomposed_at = null;
  } else if (existing?.last_decomposed_at !== undefined) {
    // Preserve existing value if we aren't explicitly overriding it
    if (node.last_decomposed_at === undefined) {
       updatedNode.last_decomposed_at = existing.last_decomposed_at;
    }
  }

  return db.nodes.put(updatedNode);
}

export { db };
