import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { renderClaudeCodePrompt } from '../utils/renderClaudeCodePrompt';
import { getArchitectureContext } from '../utils/architectureContext';
import { getAncestorChain } from '../utils/getAncestorChain';
import { calculateReadiness } from '../utils/calculateReadiness';

const BADGE_LABEL: Record<string, string> = {
  green: '🟢 Ready',
  amber: '🟡 Refine',
  red:   '🔴 Draft',
};

export function PromptSandbox({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const node = useLiveQuery(() => db.nodes.get(nodeId), [nodeId]);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!node) return;
    let active = true;
    async function build() {
      const ancestors = await getAncestorChain(node!);
      const projectNode = ancestors.find(a => a.type === 'project') ?? (node!.type === 'project' ? node! : null);
      const archCtx = projectNode ? getArchitectureContext(projectNode) : '';
      const rendered = renderClaudeCodePrompt(node!, ancestors, archCtx);
      if (active) setPrompt(rendered);
    }
    build();
    return () => { active = false; };
  }, [node]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!node) return null;

  const { readiness } = calculateReadiness(node);
  const lastReview = node.last_review ?? null;

  const reviewSummary = (() => {
    if (!lastReview) return null;
    if (lastReview.passed) return '✅ Passed last review';
    const blocking = lastReview.issues.filter(i => i.severity === 'blocking').length;
    const total = lastReview.issues.length;
    return `${total} issue${total !== 1 ? 's' : ''} found${blocking > 0 ? ` (${blocking} blocking)` : ''}`;
  })();

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[700px] bg-white rounded-xl shadow-2xl z-[101] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b bg-slate-50 shrink-0">
            <div className="flex flex-col gap-0.5">
              <Dialog.Title className="font-bold text-lg text-slate-800 leading-tight">
                {node.title}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 sr-only">
                Claude Code prompt sandbox for this node
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-3">
              <span
                data-testid="sandbox-readiness-badge"
                className="text-sm font-semibold"
              >
                {BADGE_LABEL[readiness]}
              </span>
              <Dialog.Close asChild>
                <button className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 transition">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Review summary bar */}
          {reviewSummary && (
            <div className={`px-6 py-2 text-sm font-medium border-b shrink-0 ${
              lastReview?.passed
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                : lastReview?.issues.some(i => i.severity === 'blocking')
                  ? 'bg-red-50 text-red-800 border-red-100'
                  : 'bg-amber-50 text-amber-800 border-amber-100'
            }`}>
              Reviewed: {reviewSummary}
            </div>
          )}

          {/* Prompt body */}
          <div
            data-testid="sandbox-prompt"
            className="flex-1 overflow-auto bg-slate-900 text-slate-50 p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed"
          >
            {prompt}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-slate-50 flex justify-end shrink-0">
            <button
              data-testid="sandbox-copy-button"
              onClick={handleCopy}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-md shadow-sm transition"
            >
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
