import { useEffect, useState } from 'react';
import { db } from '../db';
import type { TaskNode } from '../types';

export function ListView() {
  const [leafTasks, setLeafTasks] = useState<TaskNode[]>([]);
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchList() {
      // AC 3: Querying strictly via type matching leaf nodes
      const tasks = await db.nodes.where('type').equals('leaf_task').toArray();
      const allEdges = await db.edges.toArray();
      
      const leafIds = new Set(tasks.map(t => t.id));
      const inDegree: Record<string, number> = {};
      const adjList: Record<string, string[]> = {};
      
      tasks.forEach(t => { inDegree[t.id] = 0; adjList[t.id] = []; });
      
      // Calculate in-degree for edges strictly linking two leaf tasks together
      allEdges.forEach(e => {
        if (e.relationship_type === 'depends_on' && leafIds.has(e.source_id) && leafIds.has(e.target_id)) {
           adjList[e.source_id].push(e.target_id);
           inDegree[e.target_id] = (inDegree[e.target_id] || 0) + 1;
        }
      });

      // Kahn's algorithm for topological sorting dependencies
      const sorted: TaskNode[] = [];
      const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);
      
      let readyC = queue.length; // Items strictly with 0 in-degree dependencies are "Ready" mapped conceptually
      
      while (queue.length > 0) {
         const current = queue.shift()!;
         const node = tasks.find(t => t.id === current);
         if (node) sorted.push(node);
         
         adjList[current]?.forEach(neighbor => {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) {
               queue.push(neighbor);
            }
         });
      }
      
      tasks.forEach(t => {
         if (!sorted.find(s => s.id === t.id)) {
            sorted.push(t);
         }
      });

      if (active) {
         setLeafTasks(sorted);
         setReadyCount(readyC);
      }
    }
    fetchList();
    return () => { active = false; };
  }, []);

  return (
    <div className="w-full h-full bg-slate-50 overflow-auto p-12">
       <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <h2 className="text-2xl font-black text-slate-800 border-b pb-4 mb-6 flex items-center justify-between tracking-tight">
            Leaf Task Execution List
            <div className="flex space-x-3 text-sm">
               <span className="font-bold bg-green-100 border border-green-200 text-green-800 px-3 py-1 rounded-full">{readyCount} Ready</span>
               <span className="font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">{leafTasks.length - readyCount} Blocked</span>
            </div>
          </h2>
          
          <div className="space-y-4">
             {leafTasks.length === 0 && <div className="text-slate-500 italic p-6 text-center border-2 border-dashed rounded-xl">No Leaf Tasks found in the graph. Complete decomposition workflows first.</div>}
             {leafTasks.map((t, idx) => (
                <div key={t.id} className="flex flex-col border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition bg-white group">
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-4">
                         <span className="bg-slate-800 text-slate-100 font-mono text-xs font-bold px-2 py-1 rounded">#{idx + 1}</span>
                         <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{t.title}</h3>
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${
                        idx < readyCount ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-600'
                      }`}>
                         {idx < readyCount ? 'Ready to Agent' : 'Blocked Upstream'}
                      </span>
                   </div>
                   <p className="text-sm text-slate-600 leading-relaxed mb-4 max-w-3xl">{t.summary}</p>
                   
                   <div className="flex gap-6 text-xs font-mono text-slate-500 pt-3 border-t">
                      <div className="flex items-center gap-1.5"><span className="uppercase text-[9px] font-bold text-slate-400 tracking-wide">Size</span> <span className="font-semibold text-slate-700">{t.size || '---'}</span></div>
                      <div className="flex items-center gap-1.5"><span className="uppercase text-[9px] font-bold text-slate-400 tracking-wide">Risk</span> <span className="font-semibold text-slate-700">{t.risk || '---'}</span></div>
                      <div className="flex items-center gap-1.5"><span className="uppercase text-[9px] font-bold text-slate-400 tracking-wide">Checks</span> <span className="font-semibold text-slate-700">{t.validation_commands?.length || 0} conditions</span></div>
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
}
