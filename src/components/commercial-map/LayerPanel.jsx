import React from 'react';
import { Trash2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAYER_ITEMS = [
  { key: 'cantons', color: '#10b981', label: 'Cantons' },
  { key: 'ancCantons', color: '#fbbf24', label: 'Anc. cantons' },
  { key: 'departements', color: '#f97316', label: 'Départements' },
  { key: 'contours', color: '#94a3b8', label: 'Contours' },
];

export default function LayerPanel({ layers, onToggleLayer, overlays, onManage, onClearAll, readOnly }) {
  const dataOverlays = overlays.filter(o => Object.keys(o.cV || {}).length > 0);

  return (
    <div className="absolute top-[60px] left-2.5 z-[800] w-[180px] bg-slate-800/95 backdrop-blur rounded-xl border border-slate-700/50 shadow-2xl flex flex-col" style={{ background: '#1e293b' }}>
      {/* CALQUES */}
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Calques</h3>
      </div>
      <div className="px-2 pb-2 space-y-0.5">
        {LAYER_ITEMS.map(item => {
          const active = !!layers[item.key];
          return (
            <button
              key={item.key}
              onClick={() => onToggleLayer(item.key)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                active ? 'bg-slate-700/60 text-white' : 'text-slate-300 hover:bg-slate-700/30'
              )}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: item.color, boxShadow: active ? `0 0 7px ${item.color}` : 'none' }}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mx-3 border-t border-slate-700/50" />

      {/* DONNÉES */}
      <div className="px-4 pt-2.5 pb-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Données</h3>
      </div>
      <div className="px-2 pb-2 space-y-0.5 flex-1 overflow-y-auto max-h-[220px]">
        {dataOverlays.length === 0 && (
          <div className="px-2.5 py-2 text-[11px] text-slate-500">Aucune donnée importée</div>
        )}
        {dataOverlays.map(o => (
          <div key={o.id}>
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#ef4444' }} />
              <span className="truncate flex-1" title={o.name}>{o.name}</span>
            </div>
            {!readOnly && (
              <button
                onClick={() => onManage(o.id)}
                className="flex items-center gap-2 w-full pl-7 pr-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                Gérer...
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Tout effacer */}
      {!readOnly && (
        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={onClearAll}
            disabled={dataOverlays.length === 0}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-500/10"
            style={{ border: '1px dashed #7f1d1d' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Tout effacer
          </button>
        </div>
      )}
    </div>
  );
}