import { useEffect, useState, useRef } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { db, putNode } from './db';
import { GraphCanvas } from './components/GraphCanvas';
import { NodeEditPanel } from './components/NodeEditPanel';
import { ListView } from './components/ListView';
import { exportToJson, exportToMarkdown } from './utils/exportEngine';

export default function App() {
  const [ready, setReady] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const graph = JSON.parse(text);
        if (graph.nodes && graph.edges) {
          await db.nodes.clear();
          await db.edges.clear();
          setActiveNodeId(null);
          
          if (graph.nodes.length) await db.nodes.bulkAdd(graph.nodes);
          if (graph.edges.length) await db.edges.bulkAdd(graph.edges);
        } else {
          alert('Invalid graph file format.');
        }
      } catch (err) {
        console.error('Failed to load graph:', err);
        alert('Failed to parse the file.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all nodes and edges? This cannot be undone.')) {
        await db.nodes.clear();
        await db.edges.clear();
        setActiveNodeId(null);
    }
  };

  useEffect(() => {
    async function initMockData() {
      try {
        const count = await db.nodes.count();
        if (count === 0) {
          const rootId = crypto.randomUUID();
          const epicId = crypto.randomUUID();
          const taskId = crypto.randomUUID();
          const leafId = crypto.randomUUID();

          await putNode({
            id: rootId, type: 'project', title: 'Task Graph Planner Delivery',
            parent_id: '', summary: 'MVP specification implementation',
            objective: 'Build local task planner', risk: 'low', size: 'large'
          });

          await putNode({
            id: epicId, type: 'epic', title: 'Phase 1 - Data & Canvas',
            parent_id: rootId, summary: 'React Flow and Dexie setup',
            objective: 'Working local scaffolding', risk: 'low', size: 'medium'
          });

          await putNode({
            id: taskId, type: 'task', title: 'Dexie Implementation',
            parent_id: epicId, summary: 'Setup dexie tables & indexes',
            objective: 'Persistence working', risk: 'low', size: 'small'
          });

          await putNode({
            id: leafId, type: 'leaf_task', title: 'Implement putNode wrap',
            parent_id: taskId, summary: 'Wrap inserts to enforce timestamps',
            objective: 'Prevent technical debt', risk: 'low', size: 'small',
            validation_commands: ['npm run lint'], tests: ['unit tests'], success_criteria: ['created_at persists']
          });

          const epic = await db.nodes.get(epicId);
          if (epic) {
            epic.updated_at = new Date(Date.now() + 60000).toISOString();
            await db.nodes.put(epic);
          }

          await db.edges.bulkPut([
            { id: crypto.randomUUID(), source_id: rootId, target_id: epicId, relationship_type: 'depends_on' },
            { id: crypto.randomUUID(), source_id: epicId, target_id: taskId, relationship_type: 'depends_on' },
            { id: crypto.randomUUID(), source_id: taskId, target_id: leafId, relationship_type: 'depends_on' }
          ]);
        }
      } catch (err) {
        console.error("DB Initialization error:", err);
      }
      setReady(true);
    }
    initMockData();
  }, []);

  if (!ready) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading Graph Engine...</div>;
  }

  return (
    <ReactFlowProvider>
      <div className="w-screen h-screen relative bg-slate-50 flex flex-col">
        <div className="h-14 border-b bg-white flex items-center justify-between px-6 z-10 shadow-sm shrink-0">
           <h1 className="font-bold text-lg text-slate-800 tracking-tight flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded-sm"></div>
              Task Graph Planner
           </h1>
           <div className="flex items-center gap-4">
               <button onClick={async () => {
                  const rawJson = await exportToJson();
                  const blob = new Blob([rawJson], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'task-graph.json';
                  a.click();
               }} className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition">Save JSON</button>
               
               <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLoad} />
               <button onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition">Load</button>

               <button onClick={handleClear} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">New / Clear</button>

               <button onClick={async () => {
                  const md = await exportToMarkdown();
                  const blob = new Blob([md], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'task-graph.md';
                  a.click();
               }} className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition mr-2">Export MD</button>

               <button 
                 onClick={async () => {
                    const newRootId = crypto.randomUUID();
                    await putNode({
                        id: newRootId,
                        type: 'project',
                        title: 'New Project Blueprint',
                        parent_id: '',
                        summary: '',
                        objective: '',
                        risk: 'low',
                        size: 'medium',
                        scope: [], out_of_scope: [], prerequisites: [], depends_on: [],
                        success_criteria: [], tests: [], validation_commands: [], notes: '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        last_decomposed_at: null
                    });
                 }}
                 className="px-4 py-1.5 text-sm bg-slate-200 text-slate-800 font-semibold rounded-md hover:bg-slate-300 transition"
               >
                 + New Project
               </button>

               <button 
                 onClick={() => setShowList(!showList)} 
                 className="px-4 py-1.5 text-sm bg-slate-800 text-white font-semibold rounded-md hover:bg-slate-700 transition"
               >
                 {showList ? 'View Graph Canvas' : 'Leaf Task List'}
               </button>
           </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex">
          {showList ? (
            <ListView />
          ) : (
             <GraphCanvas activeNodeId={activeNodeId} onNodeSelect={setActiveNodeId} />
          )}

          {activeNodeId && !showList && (
            <NodeEditPanel 
              nodeId={activeNodeId} 
              onClose={() => setActiveNodeId(null)} 
            />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
