import { useState, useEffect } from 'react';
import { db, putNode } from '../db';
import type { TaskNode } from '../types';
import { X, Sparkles, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { PromptSandbox } from './PromptSandbox';
import { ModelSelector } from './ModelSelector';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function NodeEditPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const [node, setNode] = useState<TaskNode | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3:14b');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchNode = async () => {
      const n = await db.nodes.get(nodeId);
      if (active && n) setNode(n);
    };
    fetchNode();
    return () => { active = false; };
  }, [nodeId]);

  const triggerDecompose = async () => {
                 if (!node) return;
                 setIsDecomposing(true);
                 setErrorMessage(null);
                 try {
                     const chain = import('../utils/graphQueries').then(m => m.getAncestorPath(node.id));
                     const resolvedChain = await chain;
                     const promptStr = import('../utils/promptRenderer').then(m => m.renderPrompt(node, resolvedChain));
                     
                     const { decomposeNode } = await import('../api');
                     const result = await decomposeNode({
                         nodePayload: node,
                         ancestorChain: resolvedChain,
                         userPrompt: await promptStr,
                         model: selectedModel,
                     }, true);
                     
                     await db.nodes.bulkPut(result);
                     
                     // Create edges linking the current node to all newly generated child nodes
                     const edgesPayload = result.map((child: any) => ({
                         id: crypto.randomUUID(),
                         source_id: node.id,
                         target_id: child.id,
                         relationship_type: 'depends_on' as const
                     }));
                     await db.edges.bulkPut(edgesPayload);

                     const updatedParent = { ...node, last_decomposed_at: new Date().toISOString() };
                     await putNode(updatedParent);
                     setNode(updatedParent);
                 } catch (e: any) {
                     setErrorMessage(e.message || "Unknown decomposition error");
                 } finally {
                     setIsDecomposing(false);
                 }
  };

  useKeyboardShortcuts({
     activeNodeId: nodeId,
     clearActiveNode: onClose,
     triggerDecompose,
     openSandbox: () => setShowSandbox(true)
  });

  const getExpectedChildType = (parentType: string) => {
      switch (parentType) {
          case 'project': return 'epic';
          case 'epic': return 'task';
          case 'task': return 'leaf_task';
          default: return 'leaf_task';
      }
  };

  const handleAddChild = async () => {
      if (!node) return;
      const childType = getExpectedChildType(node.type);
      const childId = crypto.randomUUID();
      const newChild: TaskNode = {
          id: childId,
          type: childType as any,
          title: `New ${childType.replace('_', ' ')}`,
          parent_id: node.id,
          summary: '',
          objective: '',
          risk: 'low',
          size: 'medium',
          scope: [],
          out_of_scope: [],
          prerequisites: [],
          depends_on: [],
          success_criteria: [],
          tests: [],
          validation_commands: [],
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_decomposed_at: null
      };
      await putNode(newChild);
      await db.edges.put({
          id: crypto.randomUUID(),
          source_id: node.id,
          target_id: childId,
          relationship_type: 'depends_on' as const
      });
  };

  const handleDelete = async () => {
      if (!node) return;
      const nodesToDelete = new Set<string>();
      const edgesToDelete = new Set<string>();
      
      const findDescendants = async (parentId: string) => {
          nodesToDelete.add(parentId);
          const childEdges = await db.edges.where('source_id').equals(parentId).toArray();
          for (const edge of childEdges) {
              edgesToDelete.add(edge.id);
              await findDescendants(edge.target_id);
          }
          const parentEdges = await db.edges.where('target_id').equals(parentId).toArray();
          for (const edge of parentEdges) {
              edgesToDelete.add(edge.id);
          }
      };
      
      await findDescendants(node.id);
      await db.nodes.bulkDelete(Array.from(nodesToDelete));
      await db.edges.bulkDelete(Array.from(edgesToDelete));
      
      onClose();
  };

  if (!node) return null;

  // AC 2: Auto-save on blur natively executes Dexie put immediately
  const handleBlur = async (field: keyof TaskNode, stringValue: string) => {
    // Basic array separation logic for MVP mock textareas
    let payloadValue: any = stringValue;
    if (['scope', 'out_of_scope', 'prerequisites', 'success_criteria', 'tests', 'validation_commands', 'depends_on'].includes(field)) {
       payloadValue = stringValue.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    const updated = { ...node, [field]: payloadValue };
    setNode(updated);
    
    // Natively updates timestamps automatically via Phase 1 put wrapper logic
    await putNode(updated);
  };

  // Helper converting arrays cleanly back to strings for textarea defaults
  const asStr = (val: any) => (Array.isArray(val) ? val.join(', ') : val || '');

  return (
    <div className="absolute top-0 right-0 h-full w-[450px] bg-white border-l shadow-2xl z-50 flex flex-col transform transition-transform">
       <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <h2 className="font-bold text-lg text-slate-800 tracking-tight">Edit <span className="bg-slate-200 px-2 py-0.5 rounded uppercase text-xs align-middle text-slate-600">{node.type}</span></h2>
          <div className="flex items-center gap-3">
            <button
               onClick={() => setShowDeleteConfirm(true)}
               className="flex items-center gap-1 text-xs bg-red-50 text-red-700 font-bold px-2 py-1.5 rounded-md hover:bg-red-100 border border-red-100 shadow-sm transition"
               title="Delete Node"
            >
               <Trash2 size={14} />
            </button>
            <button
               onClick={() => setShowSandbox(true)}
               className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-md hover:bg-indigo-100 border border-indigo-100 shadow-sm transition"
            >
               <Sparkles size={14} /> Sandbox
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition rounded-md"><X size={18} /></button>
          </div>
       </div>

        {errorMessage && (
         <div className="mx-5 mt-5 mb-0 bg-red-50 border-l-4 border-red-500 p-3 shadow-sm flex items-start gap-3 rounded-r-md min-h-[3rem]">
            <div className="font-bold text-red-700 text-sm whitespace-nowrap">⚠ Error</div>
            <div className="flex-1 overflow-hidden break-words text-sm text-red-900">{errorMessage}</div>
            <button className="text-red-400 hover:text-red-700 font-bold px-1" onClick={() => setErrorMessage(null)}>X</button>
         </div>
       )}

       {showDeleteConfirm && (
         <div className="mx-5 mt-5 mb-0 bg-red-100 border border-red-300 p-4 shadow-sm flex flex-col gap-3 rounded-md min-h-[3rem]">
            <div className="font-bold text-red-800 text-sm">⚠ Warning: This will delete this node AND ALL its child nodes!</div>
            <div className="flex gap-3 justify-end mt-1">
               <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded font-semibold transition">Cancel</button>
               <button onClick={handleDelete} className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 font-bold rounded transition">Yes, Delete</button>
            </div>
         </div>
       )}

       <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-sm">
          <div className="space-y-1.5">
             <label className="font-semibold text-slate-700 block text-xs uppercase tracking-wide">Title</label>
             <input 
               className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition" 
               value={asStr(node.title)}
               onChange={e => setNode({ ...node, title: e.target.value })}
               onBlur={e => handleBlur('title', e.target.value)}
             />
          </div>
          
          <div className="space-y-1.5">
             <label className="font-semibold text-slate-700 block text-xs uppercase tracking-wide">Summary</label>
             {/* v3.1 Safety Check: No dangerouslySetInnerHTML */}
             <textarea 
               className="w-full border p-2 rounded-md h-20 focus:ring-2 focus:ring-blue-500 outline-none transition resize-none" 
               value={asStr(node.summary)}
               onChange={e => setNode({ ...node, summary: e.target.value })}
               onBlur={e => handleBlur('summary', e.target.value)}
               placeholder="Brief AI-generated or manual summary"
             />
          </div>
          
          <div className="space-y-1.5">
             <label className="font-semibold text-slate-700 block text-xs uppercase tracking-wide">Objective</label>
             {/* v3.1 Safety Check: No dangerouslySetInnerHTML */}
             <textarea 
               className="w-full border p-2 rounded-md h-20 focus:ring-2 focus:ring-blue-500 outline-none transition resize-none" 
               value={asStr(node.objective)}
               onChange={e => setNode({ ...node, objective: e.target.value })}
               onBlur={e => handleBlur('objective', e.target.value)}
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="font-semibold text-slate-700 block text-xs uppercase tracking-wide">Size</label>
               <select 
                 className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                 value={node.size}
                 onChange={e => {
                    const sz = e.target.value as any;
                    setNode({ ...node, size: sz });
                    handleBlur('size', sz);
                 }}
               >
                 {['x-small', 'small', 'medium', 'large', 'x-large'].map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            
            <div className="space-y-1.5">
               <label className="font-semibold text-slate-700 block text-xs uppercase tracking-wide">Risk</label>
               <select 
                 className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                 value={node.risk}
                 onChange={e => {
                    const r = e.target.value as any;
                    setNode({ ...node, risk: r });
                    handleBlur('risk', r);
                 }}
               >
                 {['low', 'medium', 'high'].map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
          </div>
          
          <div className="space-y-1.5 pt-2 border-t text-xs">
             <p className="text-slate-500 italic mb-2">Separate array items below via comma</p>
             <label className="font-semibold text-slate-700 block uppercase tracking-wide">Validation Commands</label>
             <input 
               className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition" 
               value={asStr(node.validation_commands)}
               onChange={e => setNode({ ...node, validation_commands: e.target.value as any })}
               onBlur={e => handleBlur('validation_commands', e.target.value)}
            />
          </div>
          
          <div className="space-y-1.5 text-xs">
             <label className="font-semibold text-slate-700 block uppercase tracking-wide">Scope Constraints</label>
             <input 
               className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition" 
               value={asStr(node.scope)}
               onChange={e => setNode({ ...node, scope: e.target.value as any })}
               onBlur={e => handleBlur('scope', e.target.value)}
            />
          </div>
       </div>

        <div className="border-t bg-slate-50">
           {/* Model selector collapsible */}
           <button
             onClick={() => setShowModelSelector(s => !s)}
             className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
           >
             <span>Model: <span className="font-mono text-slate-700">{selectedModel}</span></span>
             {showModelSelector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
           </button>
           {showModelSelector && (
             <div className="px-4 pb-3">
               <ModelSelector selectedModel={selectedModel} onModelChange={m => { setSelectedModel(m); setShowModelSelector(false); }} />
             </div>
           )}
           <div className="p-4 pt-2 flex gap-2">
              <button 
                onClick={triggerDecompose}
                className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition disabled:opacity-50"
                disabled={isDecomposing}
              >
                {isDecomposing ? 'Decomposing...' : 'Decompose (Local AI)'}
              </button>
              {node.type !== 'leaf_task' && (
                <button 
                  onClick={handleAddChild}
                  className="flex-[1] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-2 rounded-md shadow-sm transition whitespace-nowrap overflow-hidden text-ellipsis"
                  title="Manually add a child node"
                >
                  + Add Child
                </button>
              )}
           </div>
        </div>

        {showSandbox && <PromptSandbox node={node} onClose={() => setShowSandbox(false)} />}
     </div>
  );
}
