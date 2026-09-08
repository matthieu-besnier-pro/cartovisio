import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
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
          'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors',
          dragOver ? 'border-sky-400 bg-sky-500/5' : 'border-slate-700/60 hover:border-slate-600 bg-slate-800/20'
        )}
      >
        <UploadCloud className="w-8 h-8 mx-auto mb-2 text-slate-500" />
        <p className="text-xs text-slate-400 leading-relaxed">Glissez votre fichier Excel ici<br />ou cliquez pour sélectionner</p>
        <p className="text-[11px] text-slate-600 mt-1.5">.xlsx / .xls</p>
      </div>
      <input
        ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
      />

      <div className="flex items-center gap-2 mt-3 px-1">
        <span className="text-[11px] text-slate-500">Col. A contient :</span>
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

      <div className="mt-3 rounded-xl bg-slate-800/30 border border-slate-700/40 p-3">
        <h4 className="text-[11px] text-rose-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileSpreadsheet className="w-3 h-3" /> Format attendu</h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <b>2 colonnes :</b><br />
          Col. A : <span className="bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">Code</span> · Col. B : <span className="bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">Commercial</span><br /><br />
          5 chiffres — auto-détection INSEE / postal.<br />
          Ligne 1 = en-têtes (ignorée).
        </p>
      </div>
    </div>
  );
}