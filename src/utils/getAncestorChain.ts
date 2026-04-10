import { db } from '../db';
import type { TaskNode } from '../types';

/**
 * Walk the parent_id chain from the given node up to root.
 * Returns the ancestor chain ordered root → immediate parent.
 * The node itself is NOT included.
 */
export async function getAncestorChain(node: TaskNode): Promise<TaskNode[]> {
  const chain: TaskNode[] = [];
  let current = node;

  while (current.parent_id) {
    const parent = await db.nodes.get(current.parent_id);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
    if (chain.length > 50) break; // defensive against circular chains
  }

  return chain; // ordered root → immediate parent
}
