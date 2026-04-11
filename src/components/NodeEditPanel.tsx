import { useState, useEffect, useRef } from 'react';
import { db, putNode } from '../db';
import type { TaskNode, ArchitectureContext } from '../types';
import type { NodeReviewReport } from '../types/review';
import { X, Sparkles, ChevronDown, ChevronUp, Trash2, Download, Upload, FileText } from 'lucide-react';
import { PromptSandbox } from './PromptSandbox';
import { ModelSelector } from './ModelSelector';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { nodeToYaml, yamlToNode, buildExportWithPrompt, YamlImportError } from '../utils/nodeYaml';

export function NodeEditPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const [node, setNode] = useState<TaskNode | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemma4:e2b');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewReport, setReviewReport] = useState<NodeReviewReport | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProposal, setRegenProposal] = useState<Partial<TaskNode> | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [archExpanded, setArchExpanded] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const archImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const fetchNode = async () => {
      const n = await db.nodes.get(nodeId);
      if (active && n) {
        setNode(n);
        if (n.last_review) setReviewReport(n.last_review);
        if (n.architecture && Object.values(n.architecture).some(v => v?.trim())) {
          setArchExpanded(true);
        }
      }
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
                     });
                     
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

  const triggerReview = async () => {
    if (!node) return;
    setIsReviewing(true);
    setReviewError(null);
    setReviewReport(null);
    try {
      const { reviewNode } = await import('../api');
      const report = await reviewNode(node, selectedModel);
      setReviewReport(report);
      const updated = { ...node, last_review: report };
      await putNode(updated);
      setNode(updated);
    } catch {
      setReviewError('Review failed — try again');
    } finally {
      setIsReviewing(false);
    }
  };

  const triggerRegen = async () => {
    if (!node || !regenInstruction.trim()) return;
    setIsRegenerating(true);
    setRegenError(null);
    setRegenProposal(null);
    try {
      const { regenNode } = await import('../api');
      // TODO: wire architecture_context from project node's architecture block (Phase B)
      const proposal = await regenNode({ node, instructions: regenInstruction, architecture_context: '', model: selectedModel });
      setRegenProposal(proposal);
    } catch {
      setRegenError('Generation failed — try again');
    } finally {
      setIsRegenerating(false);
    }
  };

  const applyRegen = async () => {
    if (!node || !regenProposal) return;
    const updated = { ...node, ...regenProposal, last_review: null };
    await putNode(updated);
    setNode(updated);
    setReviewReport(null);
    setRegenProposal(null);
    setRegenInstruction('');
    setShowRegenInput(false);
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

  // ── Import / Export handlers ────────────────────────────────────────────

  const handleExport = () => {
    const content = nodeToYaml(node);
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `node-${node.id.slice(0, 8)}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWithPrompt = () => {
    const content = buildExportWithPrompt(node);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `node-${node.id.slice(0, 8)}-coaching-prompt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportArchPrompt = async () => {
    const allNodes = await db.nodes.toArray();
    const nodeDescriptions = allNodes.map(n => `- [${n.type}] ${n.title}: ${n.summary}`).join('\n');
    const prompt = `You are an expert software architect. Below is a list of all nodes in our task graph planner:

${nodeDescriptions}

Based on this project structure, please propose a clear Architecture Context. 
The Architecture Context is injected into all LLM prompts to provide technical guidance.
It consists of 6 fields:
1. stack
2. auth_pattern
3. deployment_target
4. key_constraints
5. naming_conventions
6. claude_rules

Please return YOUR ENTIRE RESPONSE as a single valid JSON object exactly matching this format, with no markdown formatting or extra text:
{
  "stack": "your suggestion",
  "auth_pattern": "your suggestion",
  "deployment_target": "your suggestion",
  "key_constraints": "your suggestion",
  "naming_conventions": "your suggestion",
  "claude_rules": "your suggestion"
}
`;

    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-prompt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportArchFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !node) return;
    e.target.value = '';
    const raw = await file.text();
    try {
        const extract = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
        const match = raw.match(extract);
        const jsonStr = match ? match[1] : raw;
        
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed === 'object' && parsed !== null) {
            const updated = { 
              ...node, 
              architecture: { 
                 stack: parsed.stack || node.architecture?.stack || '',
                 auth_pattern: parsed.auth_pattern || node.architecture?.auth_pattern || '',
                 deployment_target: parsed.deployment_target || node.architecture?.deployment_target || '',
                 key_constraints: parsed.key_constraints || node.architecture?.key_constraints || '',
                 naming_conventions: parsed.naming_conventions || node.architecture?.naming_conventions || '',
                 claude_rules: parsed.claude_rules || node.architecture?.claude_rules || ''
              } 
            };
            setNode(updated);
            await putNode(updated);
            setArchExpanded(true);
        } else {
            throw new Error("Invalid object format.");
        }
    } catch(err) {
        setErrorMessage("Failed to parse Architecture Context. Ensure the file contains valid JSON.");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-imported
    e.target.value = '';
    const raw = await file.text();
    try {
      const imported = yamlToNode(raw, node);
      await putNode(imported);
      setNode(imported);
      setReviewReport(null); // last_review nulled on import
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 2000);
    } catch (err) {
      if (err instanceof YamlImportError) {
        setErrorMessage(`Import failed: ${err.message}. ${err.hint}`);
      } else {
        setErrorMessage('Import failed — unexpected error.');
      }
    }
  };

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

  const formatFieldValue = (val: unknown): string => {
    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) return '[none]';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[450px] bg-white border-l shadow-2xl z-50 flex flex-col transform transition-transform">
       {/* Hidden file input for YAML import */}
       <input
         ref={importFileRef}
         type="file"
         accept=".yaml,.yml"
         className="hidden"
         data-testid="import-file-input"
         onChange={handleImportFile}
       />
       <input
         ref={archImportRef}
         type="file"
         accept=".json,.txt"
         className="hidden"
         onChange={handleImportArchFile}
       />
       <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <h2 className="font-bold text-lg text-slate-800 tracking-tight">Edit <span className="bg-slate-200 px-2 py-0.5 rounded uppercase text-xs align-middle text-slate-600">{node.type}</span></h2>
          <div className="flex items-center gap-2">
            <button
               onClick={() => setShowDeleteConfirm(true)}
               className="flex items-center gap-1 text-xs bg-red-50 text-red-700 font-bold px-2 py-1.5 rounded-md hover:bg-red-100 border border-red-100 shadow-sm transition"
               title="Delete Node"
               data-testid="delete-node-button"
            >
               <Trash2 size={14} />
            </button>
            <button
               onClick={() => setShowSandbox(true)}
               className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-md hover:bg-indigo-100 border border-indigo-100 shadow-sm transition"
            >
               <Sparkles size={14} /> Sandbox
            </button>
            {/* ── Import / Export buttons ── */}
            <button
               onClick={handleExport}
               className="flex items-center gap-1 text-xs bg-slate-50 text-slate-700 font-bold px-2 py-1.5 rounded-md hover:bg-slate-100 border border-slate-200 shadow-sm transition"
               title="Export node as YAML"
               data-testid="export-yaml-button"
            >
               <Download size={14} />
            </button>
            <button
               onClick={() => importFileRef.current?.click()}
               className="flex items-center gap-1 text-xs bg-slate-50 text-slate-700 font-bold px-2 py-1.5 rounded-md hover:bg-slate-100 border border-slate-200 shadow-sm transition"
               title="Import node from YAML"
               data-testid="import-yaml-button"
            >
               <Upload size={14} />
            </button>
            <button
               onClick={handleExportWithPrompt}
               className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 font-bold px-2 py-1.5 rounded-md hover:bg-amber-100 border border-amber-100 shadow-sm transition"
               title="Export with LLM coaching prompt"
               data-testid="export-prompt-button"
            >
               <FileText size={14} />
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

        {importSuccess && (
         <div data-testid="import-success-banner" className="mx-5 mt-5 mb-0 bg-emerald-50 border-l-4 border-emerald-500 p-3 shadow-sm flex items-center gap-2 rounded-r-md">
            <div className="font-bold text-emerald-700 text-sm">✓ Node imported successfully</div>
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

          {node.type === 'project' && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={() => setArchExpanded(e => !e)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
                >
                  Architecture Context
                  <span className="font-normal text-slate-400 normal-case tracking-normal hidden min-[400px]:inline">ℹ️ Injected into LLM prompts</span>
                  {archExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <div className="flex gap-2">
                   <button onClick={handleExportArchPrompt} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 font-semibold transition" title="Generate LLM Prompt">Prompt LLM</button>
                   <button onClick={() => archImportRef.current?.click()} className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 font-semibold transition" title="Import LLM Output">Import JSON</button>
                </div>
              </div>

              {archExpanded && (
                <div className="mt-3 space-y-3">
                  {(
                    [
                      { key: 'stack',              label: 'Stack',               placeholder: 'e.g. React 19 + TypeScript + FastAPI + Dexie.js' },
                      { key: 'auth_pattern',       label: 'Auth Pattern',        placeholder: 'e.g. HttpOnly cookie sessions, JWT' },
                      { key: 'deployment_target',  label: 'Deployment Target',   placeholder: 'e.g. Vercel (frontend) + Railway (backend)' },
                      { key: 'key_constraints',    label: 'Key Constraints',     placeholder: 'e.g. Local-first, no cloud DB, Anthropic API only' },
                      { key: 'naming_conventions', label: 'Naming Conventions',  placeholder: 'e.g. camelCase components, snake_case Python' },
                      { key: 'claude_rules',       label: 'Claude Rules',        placeholder: 'e.g. Stay in scope. Stop and ask on ambiguity.' },
                    ] as Array<{ key: keyof ArchitectureContext; label: string; placeholder: string }>
                  ).map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block">{label}</label>
                      <textarea
                        className="w-full border p-2 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none transition resize-none h-8 focus:h-16"
                        placeholder={placeholder}
                        value={node.architecture?.[key] ?? ''}
                        onChange={e => {
                          const updated = { ...node, architecture: { ...node.architecture, [key]: e.target.value } };
                          setNode(updated);
                        }}
                        onBlur={e => {
                          const updated = { ...node, architecture: { ...node.architecture, [key]: e.target.value } };
                          setNode(updated);
                          putNode(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t space-y-3">
            <button
              data-testid="review-task-button"
              onClick={triggerReview}
              disabled={isReviewing}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition disabled:opacity-50"
            >
              {isReviewing ? 'Reviewing…' : 'Review Task'}
            </button>

            {reviewError && (
              <p className="text-sm text-red-700 font-medium">{reviewError}</p>
            )}

            {reviewReport && !reviewError && (
              <div data-testid="review-report" className="space-y-2 text-sm">
                {reviewReport.passed ? (
                  <p className="text-emerald-700 font-semibold">✅ This task is ready for Claude Code.</p>
                ) : (
                  <>
                    <p className="font-semibold text-slate-700">Issues found:</p>

                    {reviewReport.issues.filter(i => i.severity === 'blocking').length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide">🔴 Blocking</p>
                        {reviewReport.issues.filter(i => i.severity === 'blocking').map((issue, idx) => (
                          <div key={idx} className="bg-red-50 border border-red-200 rounded-md px-3 py-2 space-y-0.5">
                            <p className="font-semibold text-red-900 text-xs">{issue.field} — {issue.problem}</p>
                            <p className="text-red-700 text-xs">Suggestion: {issue.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {reviewReport.issues.filter(i => i.severity === 'refine').length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">🟡 Refine</p>
                        {reviewReport.issues.filter(i => i.severity === 'refine').map((issue, idx) => (
                          <div key={idx} className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-0.5">
                            <p className="font-semibold text-amber-900 text-xs">{issue.field} — {issue.problem}</p>
                            <p className="text-amber-700 text-xs">Suggestion: {issue.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t space-y-3">
            {!showRegenInput ? (
              <button
                data-testid="regen-button"
                onClick={() => setShowRegenInput(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition"
              >
                Regenerate…
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  data-testid="regen-instruction"
                  className="w-full border p-2 rounded-md h-16 focus:ring-2 focus:ring-blue-500 outline-none transition resize-none text-sm"
                  placeholder="e.g. Make the objective more specific and add two validation commands"
                  value={regenInstruction}
                  onChange={e => setRegenInstruction(e.target.value)}
                  disabled={isRegenerating}
                />
                <div className="flex items-center gap-3">
                  <button
                    data-testid="regen-generate-button"
                    onClick={triggerRegen}
                    disabled={isRegenerating || !regenInstruction.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm shadow-sm transition disabled:opacity-50"
                  >
                    {isRegenerating ? 'Generating…' : 'Generate'}
                  </button>
                  <button
                    onClick={() => { setShowRegenInput(false); setRegenProposal(null); setRegenError(null); setRegenInstruction(''); }}
                    className="text-slate-500 hover:text-slate-700 text-sm transition"
                  >
                    Cancel
                  </button>
                </div>

                {regenError && (
                  <p className="text-sm text-red-700 font-medium">{regenError}</p>
                )}

                {regenProposal && !regenError && (
                  <div data-testid="regen-preview" className="space-y-2">
                    <p className="font-semibold text-slate-700 text-sm">Proposed changes:</p>
                    {Object.entries(regenProposal).map(([field, value]) => (
                      <div key={field} className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-1">
                        <p className="font-semibold text-slate-800 text-xs uppercase tracking-wide">{field}</p>
                        <p className="text-xs text-red-700 font-mono">Before: {formatFieldValue(node[field as keyof TaskNode])}</p>
                        <p className="text-xs text-emerald-700 font-mono">After:  {formatFieldValue(value)}</p>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button
                        data-testid="regen-apply-button"
                        onClick={applyRegen}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-md text-sm shadow-sm transition"
                      >
                        Apply Changes
                      </button>
                      <button
                        data-testid="regen-discard-button"
                        onClick={() => setRegenProposal(null)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-1.5 px-4 rounded-md text-sm shadow-sm transition"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                {isDecomposing ? 'Decomposing...' : 'Decompose Task'}
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

        {showSandbox && <PromptSandbox nodeId={nodeId} onClose={() => setShowSandbox(false)} />}
     </div>
  );
}
