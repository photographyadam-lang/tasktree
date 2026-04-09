import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { TaskNode } from '../types';
import { useEffect, useState } from 'react';
import { renderPrompt } from '../utils/promptRenderer';
import { getAncestorPath } from '../utils/graphQueries';

// Validation Schema Mock per §11.6 + AC5
function validateSchema(node: TaskNode) {
  const missing = [];
  if (!node.title) missing.push('title');
  if (!node.summary) missing.push('summary');
  if (!node.objective) missing.push('objective');
  if (node.type === 'leaf_task') {
    if (!node.success_criteria?.length) missing.push('success_criteria');
    if (!node.tests?.length) missing.push('tests');
    if (!node.validation_commands?.length) missing.push('validation_commands');
  }
  return missing;
}

export function PromptSandbox({ node, onClose }: { node: TaskNode; onClose: () => void }) {
  const [promptData, setPromptData] = useState<string>('');
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    async function init() {
      // Fetch ancestors gracefully avoiding failures on Root
      const ancestors = await getAncestorPath(node.id);
      
      // Delimit context vs task metadata natively within renderer
      const text = renderPrompt(node, ancestors);
      
      setPromptData(text);
      setMissingFields(validateSchema(node));
    }
    init();
  }, [node]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[650px] bg-white rounded-xl shadow-2xl p-6 z-[101] flex flex-col">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <Dialog.Title className="font-bold text-xl text-slate-800">Prompt Sandbox</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500">Preview §11.5 Golden Prompt rendering</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
            </Dialog.Close>
          </div>
          
          {missingFields.length > 0 && (
            <div className="bg-red-50 text-red-900 px-4 py-3 my-4 rounded-md border border-red-200">
               <strong className="font-bold">Validation Blocked: </strong> 
               Missing required fields before generation: <span className="font-mono bg-white px-2 rounded ml-2">{missingFields.join(', ')}</span>
            </div>
          )}

          <div className="flex-1 overflow-auto mt-4 bg-slate-900 text-slate-50 p-5 rounded-lg font-mono text-sm shadow-inner whitespace-pre-wrap leading-relaxed">
             {promptData}
          </div>
          
          <div className="mt-4 flex justify-end gap-3 border-t pt-4">
             <button onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
             <button 
               disabled={missingFields.length > 0} 
               className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 font-semibold rounded-md shadow-sm hover:bg-blue-700 transition"
             >
                Copy to Clipboard
             </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
