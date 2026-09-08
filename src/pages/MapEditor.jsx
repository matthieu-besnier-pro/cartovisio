import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import CommercialMapEditor from '@/components/commercial-map/CommercialMapEditor';
import { Loader2 } from 'lucide-react';

export default function MapEditor() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rec = await base44.entities.CommercialMap.get(id);
        setRecord(rec);
      } catch (e) {
        setError(e.message || 'Carte introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async (data) => {
    await base44.entities.CommercialMap.update(id, data);
    setRecord(prev => ({ ...prev, ...data }));
  };

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-slate-400"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  if (error) return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-rose-400 text-sm">{error}</div>;
  return <CommercialMapEditor record={record} readOnly={false} onSave={handleSave} />;
}