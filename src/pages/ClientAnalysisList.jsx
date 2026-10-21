import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, Plus, Trash2, Loader2, BarChart3, Users, Euro } from 'lucide-react';
import { fmtEuro } from '@/lib/clientAnalysisUtils';

export default function ClientAnalysisList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ClientMap.list('-created_date', 100);
      // Lightweight per-map stats (client count + CA) computed from the points.
      const enriched = await Promise.all((list || []).map(async m => {
        try {
          const pts = await base44.entities.ClientPoint.filter({ mapId: m.id }, '-created_date', 5000);
          const ca = (pts || []).reduce((s, p) => s + (Number.isFinite(p.ca2026) ? p.ca2026 : 0), 0);
          return { ...m, _count: (pts || []).length, _ca: ca };
        } catch { return { ...m, _count: 0, _ca: 0 }; }
      }));
      setMaps(enriched);
    } catch (e) {
      toast({ title: 'Erreur de chargement', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!title.trim()) { toast({ title: 'Titre requis', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      const rec = await base44.entities.ClientMap.create({
        title: title.trim(), description: desc.trim(), colorMode: 'caTotal',
      });
      setCreateOpen(false); setTitle(''); setDesc('');
      navigate(`/analyse-clients/${rec.id}`);
    } catch (e) {
      toast({ title: 'Erreur création', description: e.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handleDelete = async (m) => {
    try {
      // Remove the analysis and the client points attached to it.
      try { await base44.entities.ClientPoint.deleteMany({ mapId: m.id }); } catch { /* best effort */ }
      await base44.entities.ClientMap.delete(m.id);
      setConfirmDelete(null);
      load();
      toast({ title: 'Analyse supprimée' });
    } catch (e) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="relative overflow-hidden border-b border-slate-800/60">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at top left, #6366f122, transparent 50%), radial-gradient(ellipse at top right, #a855f722, transparent 50%)' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-100 flex items-center gap-1.5 text-sm mb-3"><ChevronLeft className="w-4 h-4" /> Retour à la galerie</button>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"><BarChart3 className="w-5 h-5 text-white" /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Portefeuille clients</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Analyses <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">clients</span>
          </h1>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">Chaque analyse contient son propre jeu de clients géolocalisés, ses réglages d'affichage et son analyse IA. Enregistrez-les et rouvrez-les quand vous voulez.</p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <Plus className="w-4 h-4" /> Nouvelle analyse
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : maps.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4"><BarChart3 className="w-8 h-8 text-slate-600" /></div>
            <h3 className="text-lg font-semibold text-slate-300">Aucune analyse enregistrée</h3>
            <p className="text-slate-500 text-sm mt-1">Créez une analyse, importez un export client, et enregistrez-la.</p>
            <Button onClick={() => setCreateOpen(true)} className="mt-5 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600"><Plus className="w-4 h-4" /> Nouvelle analyse</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map(m => (
              <div key={m.id} className="group rounded-2xl bg-slate-900/60 border border-slate-800/60 overflow-hidden hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-black/30 flex flex-col">
                <button onClick={() => navigate(`/analyse-clients/${m.id}`)} className="text-left p-4 flex-1">
                  <h3 className="font-bold text-slate-100 truncate group-hover:text-white">{m.title}</h3>
                  {m.description ? <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p> : <p className="text-xs text-slate-600 mt-1 italic">Aucune description</p>}
                  <div className="flex items-center gap-3 mt-3 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-slate-400"><Users className="w-3.5 h-3.5" /> {m._count}</span>
                    {m._ca > 0 && <span className="inline-flex items-center gap-1 text-indigo-300"><Euro className="w-3.5 h-3.5" /> {fmtEuro(m._ca)}</span>}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-2">{new Date(m.created_date).toLocaleDateString('fr-FR')}</div>
                </button>
                <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-slate-800/60">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/analyse-clients/${m.id}`)} className="h-8 gap-1.5 text-xs flex-1 border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-700/40">
                    <BarChart3 className="w-3.5 h-3.5" /> Ouvrir
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(m)} className="h-8 w-8 p-0 border-slate-700 bg-slate-800/40 text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-400" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 pb-8">Outil développé par le Service Marketing du Pôle Agricole du Groupe Dubreuil</p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle analyse clients</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Titre</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : CA magasin Arnac-la-Poste 2024-2026" className="mt-1.5" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description (optionnel)</label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex : Agri Gonnin-Duris" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-700">Annuler</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer cette analyse ?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">« {confirmDelete?.title} » et ses {confirmDelete?._count} clients importés seront définitivement supprimés.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} className="border-slate-700">Annuler</Button>
            <Button variant="destructive" onClick={() => handleDelete(confirmDelete)} className="gap-2"><Trash2 className="w-4 h-4" /> Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
