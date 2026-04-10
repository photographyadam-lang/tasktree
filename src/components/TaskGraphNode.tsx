import { Handle, Position } from 'reactflow';
import type { TaskNode } from '../types';
import { calculateReadiness } from '../utils/calculateReadiness';

const READINESS_BADGE: Record<string, { label: string; icon: string; className: string }> = {
  green: { label: 'Ready',  icon: '🟢', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  amber: { label: 'Refine', icon: '🟡', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  red:   { label: 'Draft',  icon: '🔴', className: 'bg-red-100 text-red-800 border border-red-300' },
};

export function TaskGraphNode({ data, selected }: { data: { taskNode: TaskNode, isStale: boolean, isAncestor: boolean }, selected?: boolean }) {
  const { type, title, size, validation_commands, tests, success_criteria } = data.taskNode;
  const { readiness } = calculateReadiness(data.taskNode);
  const badge = READINESS_BADGE[readiness];

  const colors = {
    project: 'border-slate-800 bg-slate-900 border-2 text-white',
    epic: 'border-purple-600 bg-purple-50 border-2 text-purple-900',
    task: 'border-blue-500 bg-blue-50 border-2 text-blue-900',
    leaf_task: 'border-emerald-500 bg-emerald-50 border-2 text-emerald-900'
  };

  const isLeaf = type === 'leaf_task';
  const missingCriteria = isLeaf && (!validation_commands?.length || !tests?.length || !success_criteria?.length);
  const tooLarge = size === 'large' || size === 'x-large';

  return (
    <div 
      data-testid={`node-card-${type}`}
      className={`relative px-4 py-3 rounded-lg w-48 shadow-sm transition-all
        ${colors[type]}
        ${selected ? 'ring-2 ring-offset-1 ring-blue-600' : ''}
        ${data.isAncestor ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
      `}
    >
      <div className="absolute -top-3 left-0 w-full flex justify-center gap-1 flex-wrap px-2">
        {data.isStale && (
          <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            STALE
          </span>
        )}
        {missingCriteria && (
          <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            ⚠ Missing Criteria
          </span>
        )}
        {tooLarge && (
          <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            Decompose Further
          </span>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="w-2 h-2 rounded-none bg-slate-400" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{type.replace('_', ' ')}</span>
          <span
            data-testid="readiness-badge"
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
          >
            {badge.icon} {badge.label}
          </span>
        </div>
        <div className="text-sm font-semibold truncate w-36 overflow-hidden">{title}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-12 bg-slate-600" />
    </div>
  );
}
