import React from 'react';
import { X, Sliders } from 'lucide-react';
import { TILES } from '@/lib/commercialMapUtils';
import { cn } from '@/lib/utils';

export default function SettingsDrawer({ open, onClose, style, onStyle, tile, onTile }) {
  if (!open) return null;
  const set = (key, val) => onStyle({ ...style, [key]: val });

  return (
    <div className="fixed top-0 right-0 h-full w-[320px] bg-slate-900/97 backdrop-blur-xl border-l border-slate-700/40 z-[2000] flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-700/40">
        <h2 className="text-xs font-bold text-sky-300 uppercase tracking-widest flex items-center gap-2"><Sliders className="w-3.5 h-3.5" /> Style & Options</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-rose-400 p-1 rounded-lg"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-3">Fond de carte</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(TILES).map(key => (
              <button
                key={key}
                onClick={() => onTile(key)}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-[11px] transition-colors',
                  tile === key ? 'border-rose-400 text-rose-400 bg-rose-500/5' : 'border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                )}
              >
                {key === 'osm' ? 'OpenStreetMap' : key === 'carto-light' ? 'Carto Light' : key === 'carto-dark' ? 'Carto Dark' : key === 'google-satellite' ? 'Satellite' : 'Aucun'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-3">Remplissage</h3>
          <Slider label="Opacité secteurs" value={Math.round(style.fillOpacity * 100)} min={10} max={100} suffix="%" onChange={(v) => set('fillOpacity', v / 100)} />
          <Slider label="Opacité atténuée" value={Math.round(style.dimOpacity * 100)} min={0} max={50} suffix="%" onChange={(v) => set('dimOpacity', v / 100)} />
        </section>

        <section>
          <h3 className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-3">Contours communes</h3>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">Afficher les contours</span>
            <button
              onClick={() => set('bordersOn', !style.bordersOn)}
              className={cn('relative w-10 h-5 rounded-full transition-colors', style.bordersOn ? 'bg-rose-500' : 'bg-slate-700')}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', style.bordersOn && 'translate-x-5')} />
            </button>
          </div>
          <Slider label="Épaisseur" value={Math.round(style.borderWeight * 10)} min={0} max={30} suffix="px" onChange={(v) => set('borderWeight', v / 10)} />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">Couleur contour</span>
            <input type="color" value={style.borderColor} onChange={(e) => set('borderColor', e.target.value)} className="w-9 h-7 rounded-lg border border-slate-700/60 cursor-pointer bg-transparent" />
          </div>
          <Slider label="Opacité contour" value={Math.round(style.borderOpacity * 100)} min={0} max={100} suffix="%" onChange={(v) => set('borderOpacity', v / 100)} />
        </section>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, suffix, onChange }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <span className="text-xs text-slate-400 flex-1">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-28 h-1 accent-rose-400 cursor-pointer" />
      <span className="text-[11px] text-sky-300 font-semibold w-12 text-right">{value}{suffix}</span>
    </div>
  );
}