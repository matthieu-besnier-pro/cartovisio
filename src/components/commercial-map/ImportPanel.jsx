import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImportPanel({ onImport, importLog, loading }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [codeType, setCodeType] = useState('auto');

  const handleFile = (file) => { if (file) onImport(file, codeType); };

  return (
    <div className="p-3 overflow-y-auto h-full">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        className={cn(
          'border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-colors',
          dragOver ? 'border-sky-400 bg-sky-500/5' : 'border-slate-700/60 hover:border-slate-600 bg-slate-800/20'
        )}
      >
        <UploadCloud className="w-8 h-8 mx-auto mb-2 text-slate-500" />
        <p className="text-xs text-slate-400 leading-relaxed">Glissez votre fichier ici<br />ou cliquez pour sélectionner</p>
        <p className="text-[11px] text-slate-600 mt-1.5 flex items-center justify-center gap-2">
          <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> Excel</span>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1"><FileCode className="w-3 h-3" /> HTML</span>
        </p>
      </div>
      <input
        ref={fileRef} type="file" accept=".xlsx,.xls,.html,.htm" className="hidden"
        onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
      />

      <div className="flex items-center gap-2 mt-3 px-1">
        <span className="text-[11px] text-slate-500">Col. A (Excel) :</span>
        <select
          value={codeType} onChange={(e) => setCodeType(e.target.value)}
          className="bg-slate-900 text-slate-200 border border-slate-700 rounded-md px-2 py-1 text-[11px] cursor-pointer"
        >
          <option value="auto">🔍 Auto-détection</option>
          <option value="insee">🏛 Codes INSEE</option>
          <option value="postal">📮 Codes postaux</option>
        </select>
      </div>

      {importLog.length > 0 && (
        <div className="mt-3 bg-black/30 rounded-lg p-2.5 max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {importLog.map((entry, i) => (
            <div key={i} className={entry.type === 'ok' ? 'text-emerald-400' : entry.type === 'err' ? 'text-rose-400' : 'text-slate-400'}>{entry.msg}</div>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-xl bg-slate-800/30 border border-slate-700/40 p-3 space-y-2.5">
        <div>
          <h4 className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileSpreadsheet className="w-3 h-3" /> Format Excel</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <b>2 colonnes :</b> Col. A <span className="bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">Code</span> · Col. B <span className="bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">Commercial</span><br />
            5 chiffres — auto INSEE/postal. Ligne 1 = en-têtes.
          </p>
        </div>
        <div className="border-t border-slate-700/40 pt-2">
          <h4 className="text-[11px] text-sky-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileCode className="w-3 h-3" /> Format HTML</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Importez un ancien fichier de carte HTML — les affectations code→commercial intégrées sont extraites automatiquement.
          </p>
        </div>
        <div className="border-t border-slate-700/40 pt-2">
          <h4 className="text-[11px] text-amber-400 font-bold uppercase tracking-wider mb-1.5">JSON / GeoJSON</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Objet <span className="text-sky-300">code → commercial</span>, tableau de lignes (code + vendeur), ou GeoJSON : les points deviennent des marqueurs, les polygones avec propriété « vendeur » des secteurs.
          </p>
        </div>
        <div className="border-t border-slate-700/40 pt-2">
          <h4 className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5">KML / KMZ / GPX</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Fichiers géographiques de points — les Placemark (KML/KMZ) et waypoints (GPX) sont importés comme marqueurs Pôle Agri.
          </p>
        </div>
      </div>
    </div>
  );
}