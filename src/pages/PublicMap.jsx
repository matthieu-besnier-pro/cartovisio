import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import CommercialMapEditor from '@/components/commercial-map/CommercialMapEditor';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function PublicMap() {
  const { token } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Filter by shareToken to find the public map
        const list = await base44.entities.CommercialMap.filter({ shareToken: token }, '-created_date', 1);
        if (list && list.length) setRecord(list[0]);
        else setError('Carte introuvable ou non publique.');
      } catch (e) {
        setError(e.message || 'Carte introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-slate-400"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  if (error) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
      <p className="text-sm">{error}</p>
      <Link to="/" className="text-rose-400 text-sm flex items-center gap-1.5 hover:text-rose-300"><ArrowLeft className="w-4 h-4" /> Retour à la galerie</Link>
    </div>
  );
  return <CommercialMapEditor record={record} readOnly={true} />;
}