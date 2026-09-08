import React, { useState, useMemo } from 'react';
import { X, Search, ArrowUpDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { syncCV } from '@/lib/commercialMapUtils';

export default function DataTableDrawer({ open, overlays, geoData, onClose, onChangeVendeur, onRemove, readOnly }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);

  const { cV, vColors } = syncCV(overlays);
  const vendors = useMemo(() => [...new Set(Object.values(cV))].sort(), [cV]);

  const rows = useMemo(() => {
    let r = Object.entries(cV).map(([code, vendeur]) => ({
      code, vendeur,
      nom: geoData[code]?.properties?.nom || '',
      dept: code.slice(0, 2),
    }));
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (q) r = r.filter(row => {
      const n = row.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n.includes(q) || row.code.includes(q) || row.vendeur.toLowerCase().includes(q);
    });
    if (filter) r = r.filter(row => row.vendeur === filter);
    const cols = ['code', 'nom', 'dept', 'vendeur'];
    const col = cols[sortCol];
    r.sort((a, b) => { const v = String(a[col]).localeCompare(String(b[col])); return sortAsc ? v : -v; });
    return r;
  }, [cV, geoData, search, filter, sortCol, sortAsc]);

  if (!open) return null;

  const sort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 lg:right-[320px] bg-slate-900/97 backdrop-blur border-t border-slate-700/40 h-[340px] z-[700] flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/40 flex-wrap">
        <h3 className="text-sm font-bold text-slate-100 whitespace-nowrap">📋 Données</h3>
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Commune, code, commercial..."
            className="w-full bg-slate-950/60 border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-slate-950/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-200">
          <option value="">Tous les commerciaux</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-xs text-slate-500">{rows.length} / {Object.keys(cV).length} communes</span>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-700/40">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-950/95">
            <tr>
              {['Code', 'Commune', 'Dept', 'Commercial'].map((h, i) => (
                <th key={h} onClick={() => sort(i)} className="px-3 py-2.5 text-left cursor-pointer font-semibold text-slate-500 text-[11px] uppercase tracking-wide border-b-2 border-slate-700/40 hover:text-sky-300">
                  <span className="inline-flex items-center gap-1">{h} <ArrowUpDown className="w-3 h-3 opacity-50" /></span>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ code, vendeur, nom, dept }) => {
              const c = vColors[vendeur] || '#888';
              return (
                <tr key={code} className="hover:bg-sky-500/5 border-b border-slate-800/40">
                  <td className="px-3 py-2 text-slate-400 font-mono">{code}</td>
                  <td className="px-3 py-2 text-slate-200">{nom}</td>
                  <td className="px-3 py-2 text-slate-400">{dept}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                      {readOnly ? (
                        <span className="text-slate-200">{vendeur}</span>
                      ) : (
                        <select
                          value={vendeur}
                          onChange={(e) => onChangeVendeur(code, e.target.value)}
                          className="bg-slate-950/60 border border-slate-700/60 rounded px-1.5 py-1 text-xs text-slate-200 cursor-pointer"
                        >
                          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                          <option value="__new__">＋ Nouveau...</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-2">
                    {!readOnly && (
                      <button onClick={() => onRemove(code)} className="text-rose-400/50 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10" title="Retirer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}