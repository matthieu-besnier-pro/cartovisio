import React from 'react';
import { Eye, EyeOff, X, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countByVendeur } from '@/lib/commercialMapUtils';

export default function LegendSidebar({ overlays, activeV, onToggleVendor, onShowAll, onToggleOverlayVisible, onRemoveOverlay, onChangeOpacity, onChangeColor, readOnly }) {
  const totalCommunes = overlays.reduce((s, o) => s + (o.visible ? Object.keys(o.cV || {}).length : 0), 0);
  const allVendors = new Set();
  overlays.forEach(o => { if (o.visible) Object.values(o.cV || {}).forEach(v => allVendors.add(v)); });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-800/60">
        <button
          onClick={onShowAll}
          className="w-full px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-700/40 text-slate-300 text-xs font-semibold transition-colors border border-slate-700/40"
        >
          Tous les secteurs
        </button>
        <div className="mt-2 text-[11px] text-slate-500 px-1">{totalCommunes} communes · {allVendors.size} commerciaux</div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {overlays.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-8 px-3">
            Aucune couche. {readOnly ? 'Cette carte est vide.' : 'Importez un fichier Excel pour commencer.'}
          </div>
        )}
        {overlays.map(o => {
          const counts = countByVendeur(o);
          const total = Object.keys(o.cV || {}).length;
          if (!total) return null;
          const opaPct = Math.round((o.opacity ?? 0.65) * 100);
          return (
            <div key={o.id} className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-100 flex-1 truncate" title={o.name}>{o.name}</span>
                <span className="text-[11px] font-bold text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded">{total}</span>
                <button onClick={() => onToggleOverlayVisible(o.id)} className="text-slate-400 hover:text-slate-100 p-1 rounded hover:bg-slate-700/40" title={o.visible ? 'Masquer' : 'Afficher'}>
                  {o.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                {!readOnly && (
                  <button onClick={() => onRemoveOverlay(o.id)} className="text-rose-400/60 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10" title="Supprimer la couche">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {o.visible && (
                <>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <input
                      type="range" min={5} max={100} value={opaPct}
                      onChange={(e) => onChangeOpacity(o.id, e.target.value)}
                      className="flex-1 h-1 accent-slate-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold w-9 text-right">{opaPct}%</span>
                  </div>
                  <div className="space-y-0.5">
                    {Object.keys(counts).sort().map(name => {
                      const c = o.vColors?.[name] || '#888';
                      const isActive = activeV === name;
                      return (
                        <div
                          key={name}
                          className={cn(
                            'flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
                            activeV ? (isActive ? 'bg-sky-500/10 ring-1 ring-sky-500/30' : 'opacity-40 hover:opacity-70') : 'hover:bg-slate-700/30'
                          )}
                          onClick={() => onToggleVendor(name)}
                        >
                          <label className="relative w-4 h-4 rounded shrink-0 shadow-sm" style={{ background: c }} onClick={(e) => e.stopPropagation()}>
                            {!readOnly && (
                              <input
                                type="color" value={c}
                                onChange={(e) => onChangeColor(o.id, name, e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            )}
                          </label>
                          <span className="text-xs font-medium text-slate-200 flex-1 truncate">{name}</span>
                          <span className="text-[11px] font-bold text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center">{counts[name]}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}