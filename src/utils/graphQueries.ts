import { db } from '../db';
import type { TaskNode } from '../types';

export function isChildStale(parent: TaskNode, child: TaskNode): boolean {
  const parentUpdated = new Date(parent.updated_at);
  const childCreated = new Date(child.created_at);
  const parentDecomposed = parent.last_decomposed_at
    ? new Date(parent.last_decomposed_at)
    : null;

  const editedAfterCreation = parentUpdated > childCreated;
  const editedAfterDecomposition = parentDecomposed ? parentUpdated > parentDecomposed : false;

  return editedAfterCreation || editedAfterDecomposition;
}

export async function getAncestorPath(nodeId: string): Promise<TaskNode[]> {
  const path: TaskNode[] = [];
  let currentId: string | null | undefined = nodeId;

  // We loop to build the path from node to root using O(depth) calls to Dexie's PK.
  while (currentId) {
    const node: TaskNode | undefined = await db.nodes.get(currentId as string);
    if (!node) break;
    
    path.push(node);
    
    if (path.length > 50) break; // Defensive boundary against circular chains
    
    currentId = node.parent_id;
  }
  
  return path.reverse(); // Standardizes output to Project -> Epic -> etc
}
