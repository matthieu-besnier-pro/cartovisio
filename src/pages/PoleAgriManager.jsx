import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, Upload, Plus, Trash2, Loader2, MapPin } from 'lucide-react';
import {
  processKmlFile, processKmzFile, processGpxFile, processPointsFile, categoryColor,
} from '@/lib/commercialMapUtils';

export default function PoleAgriManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', lat: '', lng: '', postalCode: '', city: '', address: '' });

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PoleAgriPoint.list('-updated_date', 5000);
      setPoints(list);
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const onLog = () => {};
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let res;
      if (ext === 'kml') res = await processKmlFile(file, onLog);
      else if (ext === 'kmz') res = await processKmzFile(file, onLog);
      else if (ext === 'gpx') res = await processGpxFile(file, onLog);
      else res = await processPointsFile(file, onLog);
      const mks = res.markers || [];
      if (!mks.length) throw new Error('Aucun point trouvé dans le fichier');
      const rows = mks.map(m => ({
        name: m.name || 'Pôle Agri', lat: m.lat, lng: m.lng,
        address: m.address || '', postalCode: m.postalCode || '', city: m.city || '', category: m.category || '',
      }));
      await base44.entities.PoleAgriPoint.bulkCreate(rows);
      toast({ title: `${rows.length} points importés ✓` });
      load();
    } catch (e) {
      toast({ title: 'Erreur import', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAdd = async () => {
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng);
    if (!form.name.trim() || isNaN(lat) || isNaN(lng)) { toast({ title: 'Nom + coordonnées requis', variant: 'destructive' }); return; }
    try {
      await base44.entities.PoleAgriPoint.create({ name: form.name.trim(), lat, lng, address: form.address.trim(), category: form.category.trim(), postalCode: form.postalCode.trim(), city: form.city.trim() });
      setForm({ name: '', category: '', lat: '', lng: '', postalCode: '', city: '', address: '' });
      load();
      toast({ title: 'Point ajouté ✓' });
    } catch (e) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (id) => {
    try { await base44.entities.PoleAgriPoint.delete(id); setPoints(p => p.filter(x => x.id !== id)); }
    catch (e) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  const handleClearAll = async () => {
    if (!points.length) return;
    if (!window.confirm(`Supprimer les ${points.length} points ?`)) return;
    try { await base44.entities.PoleAgriPoint.deleteMany({}); load(); toast({ title: 'Tous les points supprimés' }); }
    catch (e) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="border-b border-slate-800/60 bg-slate-900/40">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-100 flex items-center gap-1.5 text-sm mb-3"><ChevronLeft className="w-4 h-4" /> Retour à la galerie</button>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center shadow-lg shadow-green-500/30"><MapPin className="w-5 h-5 text-white" /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Couche globale</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Points de vente Pôle Agri</h1>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl leading-relaxed">Liste partagée affichée comme couche supplémentaire sur toutes les cartes. Modifiez-la ici : chaque carte est automatiquement mise à jour.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2 bg-gradient-to-r from-green-500 to-lime-600 hover:from-green-600 hover:to-lime-700">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importer un fichier
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.json,.geojson,.kml,.kmz,.gpx" className="hidden" onChange={(e) => e.target.files[0] && handleImport(e.target.files[0])} />
            <Button variant="outline" onClick={handleClearAll} className="gap-2 border-slate-700 text-rose-400 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /> Tout supprimer</Button>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="w-3.5 h-3.5" /> {points.length} point{points.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 p-4 mb-6">
          <h3 className="text-sm font-bold text-slate-200 mb-3">Ajouter un point manuellement</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du point" />
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Catégorie" />
            <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="Latitude" />
            <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="Longitude" />
            <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="CP" />
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ville" />
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adresse (option)" className="flex-1" />
            <Button onClick={handleAdd} className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4" /> Ajouter</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : points.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-3"><MapPin className="w-7 h-7 text-slate-600" /></div>
            <h3 className="text-base font-semibold text-slate-300">Aucun point pour l'instant</h3>
            <p className="text-slate-500 text-sm mt-1">Importez votre liste (Excel, CSV, KML/KMZ, GPX…) ou ajoutez des points manuellement.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold">Catégorie</th>
                  <th className="text-left px-4 py-3 font-semibold">CP</th>
                  <th className="text-left px-4 py-3 font-semibold">Ville</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Latitude</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Longitude</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Adresse</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {points.map(p => (
                  <tr key={p.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-100 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      {p.category ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-300"><span className="w-2.5 h-2.5 rounded-full" style={{ background: categoryColor(p.category) }} />{p.category}</span> : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{p.postalCode || '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{p.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden md:table-cell">{p.lat}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden md:table-cell">{p.lng}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{p.address || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(p.id)} className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-10 mb-4">Outil développé par le Service Marketing du Pôle Agricole du Groupe Dubreuil</p>
      </div>
    </div>
  );
}