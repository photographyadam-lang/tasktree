import { db } from '../db';
import type { TaskNode } from '../types';

export async function exportToJson() {
  const nodes = await db.nodes.toArray();
  const edges = await db.edges.toArray();
  
  const graph = {
    metadata: { exported_at: new Date().toISOString() },
    nodes,
    edges
  };
  
  // Rule 6 Security Constraint: Returning string representation without triggering console.log dumps of Dexie.
  return JSON.stringify(graph, null, 2);
}

export async function exportToMarkdown() {
  const nodes = await db.nodes.toArray();
  
  // Create an adjacency list representation mapping `parent_id` to children
  const childrenMap: Record<string, TaskNode[]> = {};
  nodes.forEach(n => {
     const pId = n.parent_id || 'root';
     if (!childrenMap[pId]) childrenMap[pId] = [];
     childrenMap[pId].push(n);
  });
  
  let markdown = `# Task Graph Project Export\n\n`;
  
  function renderNode(nodeId: string, depth: number) {
     const currentLevel = childrenMap[nodeId] || [];
     
     // AC 4: Markdown output preserves '#' headers scaling per branch depth correctly
     const heading = '#'.repeat(Math.min(depth, 6)); 
     
     currentLevel.forEach(child => {
        markdown += `${heading} [${child.type.toUpperCase()}] ${child.title}\n`;
        markdown += `**Summary:** ${child.summary}\n`;
        markdown += `**Objective:** ${child.objective}\n`;
        markdown += `**Size:** ${child.size} | **Risk:** ${child.risk}\n\n`;
        
        if (child.validation_commands && child.validation_commands.length > 0) {
           markdown += `**Validations:**\n`;
           child.validation_commands.forEach(cmd => markdown += `- \`${cmd}\`\n`);
           markdown += `\n`;
        }
        
        // Traverse downwards
        renderNode(child.id, depth + 1);
     });
  }
  
  renderNode('root', 2);
  renderNode('', 2); // Some root nodes historically had empty string as parent_id
  
  return markdown;
}
