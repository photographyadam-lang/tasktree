import { Handle, Position, type NodeProps } from 'reactflow';
import type { TaskNode } from '../types';

const typeColors = {
  project: 'bg-blue-100 border-blue-400',
  epic: 'bg-teal-100 border-teal-400',
  task: 'bg-slate-100 border-slate-400',
  leaf_task: 'bg-green-100 border-green-400'
};

export function TaskGraphNode({ data, selected }: NodeProps) {
  const { taskNode, isStale, isAncestor } = data as { taskNode: TaskNode, isStale: boolean, isAncestor: boolean };
  
  // XSS Defense Comment (v3.1 specification requirement)
  // NEVER use dangerouslySetInnerHTML here or in slide-out panel for rendering AI-generated summary/objective fields.
  
  const outerClasses = `min-w-[160px] px-3 py-2 shadow-sm rounded-md border-2 
    ${typeColors[taskNode.type]}
    ${selected ? 'ring-2 ring-offset-1 ring-blue-600' : ''}
    ${isAncestor ? 'border-amber-500 border-4 shadow-amber-200' : ''}
  `;
  
  return (
    <div className={outerClasses}>
      <Handle type="target" position={Position.Top} className="w-12 bg-slate-600" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
           <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">{taskNode.type.replace('_', ' ')}</span>
           {isStale && <span className="text-[9px] bg-amber-500 text-amber-50 px-1.5 py-0.5 rounded-full shadow-sm font-semibold tracking-wider">STALE</span>}
        </div>
        <div className="text-sm font-semibold truncate w-36 text-slate-900">{taskNode.title}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-12 bg-slate-600" />
    </div>
  );
}
