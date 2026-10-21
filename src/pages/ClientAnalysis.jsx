import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronLeft, Upload, Trash2, Loader2, Sparkles, TrendingUp, TrendingDown,
  Users, Search, X, BarChart3, Save,
} from 'lucide-react';
import { TILES } from '@/lib/commercialMapUtils';
import {
  parseClientFile, geocodeClients, buildStats, COLOR_MODES, pointColor, pointRadius,
  percentileMax, categoryColors, caEvolution, fmtEuro, statutLabel, statutColor, STATUT_LIST,
} from '@/lib/clientAnalysisUtils';

const CHUNK = 200;

export default function ClientAnalysis() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const didFitRef = useRef(false);

  const [record, setRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState([]);
  const [colorMode, setColorMode] = useState('caTotal');
  const [statutFilter, setStatutFilter] = useState([]);   // [] = tous
  const [deptFilter, setDeptFilter] = useState('');
  const [query, setQuery] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');

  const pushLog = useCallback((m, t) => setLog(l => [...l.slice(-60), { m, t }]), []);

  // ── Data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, list] = await Promise.all([
        base44.entities.ClientMap.get(id),
        base44.entities.ClientPoint.filter({ mapId: id }, '-created_date', 5000),
      ]);
      setRecord(rec);
      setClients(list || []);
      // Restore saved display settings
      if (rec?.colorMode) setColorMode(rec.colorMode);
      if (rec?.aiAnalysis) setAiText(rec.aiAnalysis);
      try {
        const f = rec?.filters ? JSON.parse(rec.filters) : null;
        if (f) {
          if (Array.isArray(f.statut)) setStatutFilter(f.statut);
          if (typeof f.dept === 'string') setDeptFilter(f.dept);
          if (typeof f.query === 'string') setQuery(f.query);
        }
      } catch { /* ignore malformed filters */ }
    } catch (e) {
      toast({ title: 'Erreur de chargement', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [id, toast]);
  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const map = mapRef.current;
      const c = map?.getCenter();
      await base44.entities.ClientMap.update(id, {
        colorMode,
        filters: JSON.stringify({ statut: statutFilter, dept: deptFilter, query }),
        mapView: c ? JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }) : '',
        aiAnalysis: aiText || '',
      });
      toast({ title: 'Analyse enregistrée ✓' });
    } catch (e) {
      toast({ title: 'Erreur sauvegarde', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true); setLog([]);
    try {
      // Statut guessed from the filename (only meaningful for the
      // portefeuille format; the CA export has no statut).
      const n = file.name.toLowerCase();
      const statut = n.includes('actif') ? 'ACTIF' : n.includes('2024') ? 'PERDU_2024' : n.includes('2025') ? 'PERDU_2025' : '';
      const rows = await parseClientFile(file, statut, pushLog);
      if (!rows.length) throw new Error('Aucun client exploitable');
      const geo = (await geocodeClients(rows, pushLog)).map(c => ({ ...c, mapId: id }));
      pushLog(`💾 Enregistrement de ${geo.length} clients…`);
      for (let i = 0; i < geo.length; i += CHUNK) {
        await base44.entities.ClientPoint.bulkCreate(geo.slice(i, i + CHUNK));
        pushLog(`   ${Math.min(i + CHUNK, geo.length)}/${geo.length}`);
      }
      pushLog('✅ Import terminé', 'ok');
      toast({ title: `${geo.length} clients importés ✓` });
      load();
    } catch (e) {
      pushLog('❌ ' + e.message, 'err');
      toast({ title: 'Erreur import', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleClearAll = async () => {
    if (!clients.length) return;
    if (!window.confirm(`Supprimer les ${clients.length} clients de cette analyse ?`)) return;
    try {
      await base44.entities.ClientPoint.deleteMany({ mapId: id });
      setAiText('');
      load();
      toast({ title: 'Données supprimées' });
    } catch (e) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const depts = useMemo(
    () => [...new Set(clients.map(c => c.departement).filter(Boolean))].sort(),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(c => {
      if (statutFilter.length && !statutFilter.includes(c.statut)) return false;
      if (deptFilter && c.departement !== deptFilter) return false;
      if (q && !(`${c.societe} ${c.ville}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [clients, statutFilter, deptFilter, query]);

  const ctx = useMemo(() => ({
    maxByMode: {
      ca2024: percentileMax(clients.map(c => c.ca2024)),
      ca2025: percentileMax(clients.map(c => c.ca2025)),
      ca2026: percentileMax(clients.map(c => c.ca2026)),
      caTotal: percentileMax(clients.map(c => c.caTotal)),
      nbPassages: percentileMax(clients.map(c => c.nbPassages)),
    },
    filialeColors: categoryColors(clients.map(c => c.filiale)),
    nafColors: categoryColors(clients.map(c => c.naf)),
  }), [clients]);

  const stats = useMemo(() => buildStats(filtered), [filtered]);
  const hasCA = useMemo(() => clients.some(c => Number.isFinite(c.caTotal) || Number.isFinite(c.ca2026)), [clients]);
  const hasStatut = useMemo(() => clients.some(c => c.statut), [clients]);

  // ── Map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(containerRef.current, {
      center: [46.3, 1.3], zoom: 8, zoomControl: false, preferCanvas: true,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    const t = TILES['esri-street'];
    L.tileLayer(t.url, t.opts).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  // Draw points whenever data / filters / colour mode change
  useEffect(() => {
    const L = window.L; const map = mapRef.current; const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const pts = filtered.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    pts.forEach(c => {
      const color = pointColor(c, colorMode, ctx);
      L.circleMarker([c.lat, c.lng], {
        radius: pointRadius(c, colorMode, ctx),
        color: '#0f172a', weight: 0.8, fillColor: color, fillOpacity: 0.85,
      }).bindPopup(popupHtml(c)).addTo(layer);
    });
    // Honour a saved view; otherwise frame the data once on first draw.
    if (!didFitRef.current && pts.length) {
      didFitRef.current = true;
      let saved = null;
      try { saved = record?.mapView ? JSON.parse(record.mapView) : null; } catch { saved = null; }
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
        map.setView([saved.lat, saved.lng], saved.zoom || 9);
      } else {
        try { map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 12 }); } catch { /* noop */ }
      }
    }
  }, [filtered, colorMode, ctx, record]);

  // ── AI analysis ─────────────────────────────────────────────────────────
  const runAI = async () => {
    if (!filtered.length) { toast({ title: 'Aucune donnée à analyser', variant: 'destructive' }); return; }
    setAiBusy(true); setAiText('');
    try {
      const res = await base44.functions.invoke('clientAnalysis', { stats, question: aiQuestion.trim() });
      const txt = res?.data?.analysis || res?.analysis;
      if (!txt) throw new Error(res?.data?.error || res?.error || 'Réponse vide');
      setAiText(txt);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.data?.error || e?.message || 'Échec de l\'analyse';
      toast({ title: 'Analyse IA', description: msg, variant: 'destructive' });
    } finally { setAiBusy(false); }
  };

  const geoOk = filtered.filter(c => Number.isFinite(c.lat)).length;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/60 shrink-0">
        <button onClick={() => navigate('/analyse-clients')} className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0"><BarChart3 className="w-4 h-4 text-white" /></div>
          <span className="font-extrabold tracking-tight truncate" title={record?.title}>{record?.title || 'Analyse clients'}</span>
        </div>
        <span className="text-xs text-slate-500">{filtered.length} client{filtered.length > 1 ? 's' : ''} · {geoOk} géolocalisé{geoOk > 1 ? 's' : ''}</span>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="h-8 gap-1.5 text-xs border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-700/40">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importer
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 gap-1.5 text-xs bg-gradient-to-r from-indigo-500 to-violet-600">
          <Save className="w-3.5 h-3.5" /> {saving ? '…' : 'Enregistrer'}
        </Button>
        {clients.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleClearAll} className="h-8 gap-1.5 text-xs border-slate-700 bg-slate-800/40 text-rose-400 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" /> Tout effacer
          </Button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" style={{ background: '#1a1a2e' }} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 z-[500]"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          )}
          {!loading && !clients.length && (
            <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
              <div className="text-center bg-slate-900/90 rounded-2xl border border-slate-700/60 px-6 py-5 pointer-events-auto">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-200">Aucune donnée client</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">Importez un export client (CA par année, ou portefeuille actif/perdu).<br />Les adresses sont géolocalisées automatiquement.</p>
                <Button size="sm" onClick={() => fileRef.current?.click()} className="mt-3 gap-1.5 text-xs bg-gradient-to-r from-indigo-500 to-violet-600"><Upload className="w-3.5 h-3.5" /> Importer un fichier</Button>
              </div>
            </div>
          )}
          {/* Legend */}
          {clients.length > 0 && <MapLegend mode={colorMode} ctx={ctx} />}
        </div>

        {/* Sidebar */}
        <aside className="w-[340px] shrink-0 border-l border-slate-800/60 bg-slate-900/70 flex flex-col overflow-y-auto">
          {/* Import log */}
          {(importing || log.length > 0) && (
            <div className="p-3 border-b border-slate-800/60">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Import</div>
              <div className="bg-slate-950/60 rounded-lg p-2 max-h-32 overflow-y-auto font-mono text-[10px] leading-relaxed">
                {log.map((l, i) => (
                  <div key={i} className={l.t === 'ok' ? 'text-green-400' : l.t === 'err' ? 'text-rose-400' : l.t === 'warn' ? 'text-amber-400' : 'text-slate-400'}>{l.m}</div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="p-3 border-b border-slate-800/60 space-y-2.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Affichage</div>
            <div>
              <label className="text-[10px] text-slate-500">Couleur des points</label>
              <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} className="w-full mt-1 bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none">
                {COLOR_MODES.filter(m => {
                  if (['ca2024', 'ca2025', 'ca2026', 'caTotal', 'evolution', 'nbPassages', 'recence'].includes(m.key)) return hasCA;
                  if (m.key === 'statut') return hasStatut;
                  return true;
                }).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-2">
              <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Société ou ville…" className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 py-1.5 outline-none" />
              {query && <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Département</label>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-full mt-1 bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none">
                <option value="">Tous ({depts.length})</option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {hasStatut && (
              <div className="flex flex-wrap gap-1.5">
                {STATUT_LIST.map(s => {
                  const on = statutFilter.includes(s.key);
                  return (
                    <button key={s.key} onClick={() => setStatutFilter(p => on ? p.filter(x => x !== s.key) : [...p, s.key])}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${on ? 'text-white' : 'text-slate-400 border-slate-700 bg-slate-800/40'}`}
                      style={on ? { background: s.color + '33', borderColor: s.color, color: s.color } : undefined}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats */}
          {clients.length > 0 && <StatsPanel stats={stats} hasCA={hasCA} />}

          {/* AI */}
          {clients.length > 0 && (
            <div className="p-3 border-t border-slate-800/60">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analyse IA</span>
              </div>
              <Input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Question précise (optionnel)…" className="text-xs h-8 mb-2" />
              <Button size="sm" onClick={runAI} disabled={aiBusy} className="w-full gap-1.5 text-xs bg-gradient-to-r from-violet-500 to-fuchsia-600">
                {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyser le portefeuille
              </Button>
              <p className="text-[9px] text-slate-600 mt-1.5 leading-snug">Seules des statistiques agrégées sont envoyées à l'IA — aucune donnée nominative.</p>
              {aiText && <Markdownish text={aiText} />}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────
function StatsPanel({ stats, hasCA }) {
  const evo = stats.evolutionCAGlobalePct;
  return (
    <div className="p-3 border-b border-slate-800/60">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Synthèse</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Card label="Clients" value={stats.total} />
        {hasCA && <Card label="CA 2026" value={fmtEuro(stats.caParAnnee[2026])} />}
        {hasCA && <Card label="CA moyen / client" value={fmtEuro(stats.caMoyenParClient)} />}
        {hasCA && evo !== null && (
          <Card label="Évolution 24→26" value={`${evo > 0 ? '+' : ''}${evo} %`} tone={evo >= 0 ? 'up' : 'down'} />
        )}
        {stats.passagesMoyen !== null && <Card label="Passages moyen" value={stats.passagesMoyen} />}
        {stats.tauxMoyen !== null && <Card label="Taux affiliation" value={stats.tauxMoyen + ' %'} />}
      </div>

      {hasCA && (
        <>
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">CA par année</div>
          <div className="space-y-1 mb-3">
            {[2024, 2025, 2026].map(y => {
              const v = stats.caParAnnee[y] || 0;
              const max = Math.max(...[2024, 2025, 2026].map(k => stats.caParAnnee[k] || 0)) || 1;
              return (
                <div key={y} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-8">{y}</span>
                  <div className="flex-1 h-3 bg-slate-800/60 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(v / max) * 100}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)' }} />
                  </div>
                  <span className="text-[10px] text-slate-300 w-16 text-right">{fmtEuro(v)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mb-3 text-[10px]">
            <span className="flex-1 text-center rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 py-1">↗ {stats.repartitionEvolution.croissance} en hausse</span>
            <span className="flex-1 text-center rounded-lg bg-slate-700/30 border border-slate-600/30 text-slate-400 py-1">= {stats.repartitionEvolution.stable}</span>
            <span className="flex-1 text-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 py-1">↘ {stats.repartitionEvolution.declin} en baisse</span>
          </div>
        </>
      )}

      {stats.topDepts.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Top départements</div>
          <div className="space-y-0.5">
            {stats.topDepts.slice(0, 6).map(d => (
              <div key={d.code} className="flex items-center gap-2 text-[11px]">
                <span className="w-6 text-slate-400 font-mono">{d.code}</span>
                <span className="flex-1 text-slate-500">{d.clients} cl.</span>
                {hasCA && <span className="text-slate-300">{fmtEuro(d.ca2026)}</span>}
                {hasCA && d.evolutionPct !== null && (
                  <span className={`w-12 text-right ${d.evolutionPct >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                    {d.evolutionPct > 0 ? '+' : ''}{d.evolutionPct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-2.5 py-2">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${tone === 'up' ? 'text-green-400' : tone === 'down' ? 'text-rose-400' : 'text-slate-100'}`}>
        {tone === 'up' && <TrendingUp className="w-3 h-3" />}
        {tone === 'down' && <TrendingDown className="w-3 h-3" />}
        {value}
      </div>
    </div>
  );
}

function MapLegend({ mode, ctx }) {
  const m = COLOR_MODES.find(x => x.key === mode);
  if (!m) return null;
  if (mode === 'statut') {
    return (
      <LegendBox title={m.label}>
        {STATUT_LIST.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-[10px] text-slate-300">
            <span className="w-3 h-3 rounded-full" style={{ background: s.color }} /> {s.label}
          </div>
        ))}
      </LegendBox>
    );
  }
  if (mode === 'filiale' || mode === 'naf') {
    const map = mode === 'filiale' ? ctx.filialeColors : ctx.nafColors;
    const entries = [...(map?.entries() || [])].slice(0, 8);
    return (
      <LegendBox title={m.label}>
        {entries.map(([k, c]) => (
          <div key={k} className="flex items-center gap-2 text-[10px] text-slate-300">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c }} />
            <span className="truncate max-w-[150px]" title={k}>{k}</span>
          </div>
        ))}
      </LegendBox>
    );
  }
  const labels = mode === 'evolution' ? ['-50 %', 'stable', '+50 %']
    : mode === 'recence' ? ['> 1 an', '6 mois', 'récent']
      : ['faible', '', 'élevé'];
  return (
    <LegendBox title={m.label}>
      <div className="h-2.5 w-40 rounded" style={{ background: 'linear-gradient(90deg, rgb(239,68,68), rgb(245,158,11), rgb(34,197,94))' }} />
      <div className="flex justify-between w-40 text-[9px] text-slate-500 mt-0.5">
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </LegendBox>
  );
}

function LegendBox({ title, children }) {
  return (
    <div className="absolute bottom-3 right-3 z-[500] rounded-xl bg-slate-900/95 backdrop-blur border border-slate-700/60 px-3 py-2 shadow-xl">
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// Very small markdown subset (## headings, - bullets, **bold**) — avoids a dep.
function Markdownish({ text }) {
  const blocks = String(text).split('\n');
  return (
    <div className="mt-3 rounded-xl bg-slate-950/50 border border-slate-800 p-3 text-[11px] leading-relaxed space-y-1.5 max-h-96 overflow-y-auto">
      {blocks.map((line, i) => {
        const l = line.trim();
        if (!l) return null;
        if (l.startsWith('## ')) return <div key={i} className="text-violet-300 font-bold text-[11px] uppercase tracking-wide pt-1.5">{l.slice(3)}</div>;
        if (l.startsWith('# ')) return <div key={i} className="text-violet-200 font-bold">{l.slice(2)}</div>;
        if (/^[-*]\s/.test(l)) return <div key={i} className="text-slate-300 pl-3 relative"><span className="absolute left-0 text-violet-400">•</span>{bold(l.slice(2))}</div>;
        return <div key={i} className="text-slate-300">{bold(l)}</div>;
      })}
    </div>
  );
}
function bold(s) {
  return String(s).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="text-slate-100">{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function esc(s) { return String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

function popupHtml(c) {
  const ev = caEvolution(c);
  const row = (k, v) => v ? `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:#64748b">${k}</span><span style="font-weight:600;color:#0f172a">${v}</span></div>` : '';
  return `<div style="font-family:Inter,system-ui,sans-serif;min-width:190px;font-size:11px">
    <div style="font-weight:700;font-size:12.5px;color:#0f172a;margin-bottom:2px">${esc(c.societe)}</div>
    <div style="color:#64748b;margin-bottom:6px">${esc([c.codePostal, c.ville].filter(Boolean).join(' '))}</div>
    ${row('CA 2024', Number.isFinite(c.ca2024) ? fmtEuro(c.ca2024) : '')}
    ${row('CA 2025', Number.isFinite(c.ca2025) ? fmtEuro(c.ca2025) : '')}
    ${row('CA 2026', Number.isFinite(c.ca2026) ? fmtEuro(c.ca2026) : '')}
    ${row('Total 3 ans', Number.isFinite(c.caTotal) ? fmtEuro(c.caTotal) : '')}
    ${ev !== null ? row('Évolution', `<span style="color:${ev >= 0 ? '#16a34a' : '#dc2626'}">${ev > 0 ? '+' : ''}${(ev * 100).toFixed(0)} %</span>`) : ''}
    ${row('Passages', Number.isFinite(c.nbPassages) ? c.nbPassages : '')}
    ${row('Dernier achat', c.dernierAchat ? new Date(c.dernierAchat).toLocaleDateString('fr-FR') : '')}
    ${row('Statut', c.statut ? `<span style="color:${statutColor(c.statut)}">${statutLabel(c.statut)}</span>` : '')}
    ${row('Activité', esc(c.naf))}
    ${row('PDV', esc(c.pointDeVente))}
  </div>`;
}
