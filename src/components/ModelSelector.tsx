import { useState, useEffect } from 'react';
import { fetchModels, type OllamaModel, type ModelsResponse } from '../api';
import { Cpu, MemoryStick } from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchModels()
      .then(d => { if (active) { setData(d); setLoading(false); } })
      .catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="text-xs text-slate-400 italic flex items-center gap-1.5 py-1">
        <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin inline-block" />
        Loading models...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
        ⚠ Backend offline — start the proxy to select a model.
      </div>
    );
  }

  if (!data) return null;

  const usedRam = data.system_ram_total_gb - data.system_ram_available_gb;
  const usedPct = Math.round((usedRam / data.system_ram_total_gb) * 100);

  return (
    <div className="space-y-2">
      {/* RAM status bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <MemoryStick size={12} className="shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between mb-0.5">
            <span>RAM Available</span>
            <span className="font-mono font-semibold text-slate-700">
              {data.system_ram_available_gb} GB / {data.system_ram_total_gb} GB
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usedPct > 85 ? 'bg-red-400' : usedPct > 65 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Model list */}
      <div className="space-y-1">
        {data.models.map((m: OllamaModel) => {
          const isSelected = m.name === selectedModel;
          const canRun = m.fits_in_ram;
          return (
            <button
              key={m.name}
              onClick={() => canRun && onModelChange(m.name)}
              disabled={!canRun}
              className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition flex items-center justify-between gap-2
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : canRun
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Cpu size={12} className="shrink-0" />
                <span className="font-mono truncate">{m.name}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-semibold">{m.size_gb} GB</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${canRun ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {canRun ? 'FITS' : 'TOO LARGE'}
                </span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
