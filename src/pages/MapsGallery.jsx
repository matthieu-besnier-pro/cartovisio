import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Map as MapIcon, Plus, Share2, Trash2, Pencil, Eye, Globe, Loader2, MapPin, Link2 } from 'lucide-react';
import { syncCV, genShareToken } from '@/lib/commercialMapUtils';

export default function MapsGallery() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.CommercialMap.list('-created_date', 100);
      setMaps(list);
    } catch (e) {
      toast({ title: 'Erreur de chargement', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) { toast({ title: 'Titre requis', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      const rec = await base44.entities.CommercialMap.create({
        title: newTitle.trim(),
        description: newDesc.trim(),
        overlays: '[]',
        mapView: '',
        departments: '[]',
        shareToken: genShareToken(),
        isPublic: true,
      });
      setCreateOpen(false); setNewTitle(''); setNewDesc('');
      navigate(`/map/${rec.id}`);
    } catch (e) {
      toast({ title: 'Erreur création', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.CommercialMap.delete(id);
      setConfirmDelete(null);
      load();
      toast({ title: 'Carte supprimée' });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const copyShare = (token) => {
    const url = `${window.location.origin}/public/${token}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: 'Lien public copié ✓' }));
  };
  const copyShareEditable = (token) => {
    const url = `${window.location.origin}/public/${token}/edit`;
    navigator.clipboard.writeText(url).then(() => toast({ title: 'Lien public modifiable copié ✓' }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-slate-800/60">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at top left, #f43f5e22, transparent 50%), radial-gradient(ellipse at top right, #8b5cf622, transparent 50%)' }} />
        <div className="relative max-w-6xl mx-auto px-6 py-12 sm:py-16">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <MapIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cartographie commerciale</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Cartes de <span className="bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">secteurs commerciaux</span>
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl text-sm sm:text-base leading-relaxed">
            Créez et hébergez vos cartes de secteurs commerciaux. Importez vos affectations par commune,
            personnalisez les couleurs, puis partagez un lien public de visualisation en lecture seule.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg shadow-rose-500/25">
              <Plus className="w-4 h-4" /> Créer une carte
            </Button>
            <Button variant="outline" onClick={() => navigate('/pole-agri')} className="gap-2 border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-700/40">
              <MapPin className="w-4 h-4" /> Points Pôle Agri
            </Button>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Liens publics</span>
              <span className="flex items-center gap-1.5"><MapIcon className="w-3.5 h-3.5" /> {maps.length} carte{maps.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : maps.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <MapIcon className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300">Aucune carte pour l'instant</h3>
            <p className="text-slate-500 text-sm mt-1">Créez votre première carte de secteurs commerciaux.</p>
            <Button onClick={() => setCreateOpen(true)} className="mt-5 gap-2 bg-gradient-to-r from-rose-500 to-pink-600">
              <Plus className="w-4 h-4" /> Créer une carte
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {maps.map(m => {
              const { cV } = syncCV(typeof m.overlays === 'string' ? JSON.parse(m.overlays || '[]') : (m.overlays || []));
              const count = Object.keys(cV).length;
              const vendors = new Set(Object.values(cV)).size;
              const accent = m.accentColor || '#f43f5e';
              return (
                <div key={m.id} className="group rounded-2xl bg-slate-900/60 border border-slate-800/60 overflow-hidden hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-black/30 flex flex-col">
                  {/* Cover */}
                  <button onClick={() => navigate(`/map/${m.id}`)} className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}11)` }}>
                    <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 30% 50%, ${accent}40, transparent 60%)` }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <MapIcon className="w-10 h-10" style={{ color: accent }} />
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      <span className="text-[10px] font-bold text-white bg-black/40 backdrop-blur px-2 py-0.5 rounded-full">{count} communes</span>
                    </div>
                  </button>
                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col">
                    <button onClick={() => navigate(`/map/${m.id}`)} className="text-left">
                      <h3 className="font-bold text-slate-100 truncate group-hover:text-white">{m.title}</h3>
                      {m.description ? <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p> : <p className="text-xs text-slate-600 mt-1 italic">Aucune description</p>}
                    </button>
                    <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
                      <span>{vendors} commercial{vendors > 1 ? 'ux' : ''}</span>
                      <span>·</span>
                      <span>{new Date(m.created_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/60">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/map/${m.id}`)} className="h-8 gap-1.5 text-xs flex-1 border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-700/40">
                        <Pencil className="w-3.5 h-3.5" /> Éditer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/public/${m.shareToken}`)} className="h-8 w-8 p-0 border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40" title="Vue publique">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyShare(m.shareToken)} className="h-8 w-8 p-0 border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40" title="Copier le lien public (lecture seule)">
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyShareEditable(m.shareToken)} className="h-8 w-8 p-0 border-amber-600/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" title="Copier le lien public modifiable">
                        <Link2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(m)} className="h-8 w-8 p-0 border-slate-700 bg-slate-800/40 text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-400" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Branding footer */}
      <p className="text-center text-xs text-slate-600 pb-8 max-w-6xl mx-auto px-6">Outil développé par le Service Marketing du Pôle Agricole du Groupe Dubreuil</p>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une nouvelle carte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Titre</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex : Secteurs Pôle Agri 2026" className="mt-1.5" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description (optionnel)</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Ex : Affectation des communes par commercial" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-700">Annuler</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-gradient-to-r from-rose-500 to-pink-600">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette carte ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">« {confirmDelete?.title} » sera définitivement supprimée. Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} className="border-slate-700">Annuler</Button>
            <Button variant="destructive" onClick={() => handleDelete(confirmDelete.id)} className="gap-2">
              <Trash2 className="w-4 h-4" /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}