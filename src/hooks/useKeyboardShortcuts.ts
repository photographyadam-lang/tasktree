import { useEffect } from 'react';
import { exportToJson } from '../utils/exportEngine';

export function useKeyboardShortcuts({
  activeNodeId,
  clearActiveNode,
  triggerDecompose,
  openSandbox
}: {
  activeNodeId: string | null;
  clearActiveNode: () => void;
  triggerDecompose?: () => void;
  openSandbox?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        clearActiveNode();
      }
      
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      // Global Export
      if (isCmdOrCtrl && e.key.toLowerCase() === 'e' && !e.shiftKey) {
        e.preventDefault();
        const jsonStr = await exportToJson();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'task-graph.json';
        a.click();
        URL.revokeObjectURL(url);
      }

      // Decompose 
      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        if (activeNodeId && triggerDecompose) triggerDecompose();
      }

      // Sandbox & Prompt 
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeNodeId && openSandbox) openSandbox();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNodeId, clearActiveNode, triggerDecompose, openSandbox]);
}
