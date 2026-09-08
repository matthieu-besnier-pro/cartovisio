import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Upload a (potentially large) JSON string as a file and return its public URL.
// Keeps the entity string field small (only the URL is stored).
async function uploadJson(base44, value: string, filename: string): Promise<string> {
  if (!value) return value;
  const blob = new Blob([value], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return file_url;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const shareToken = String(body?.shareToken || '').trim();
    if (!shareToken) return Response.json({ error: 'Token manquant' }, { status: 400 });

    // Public endpoint: the shareToken is the shared secret that authorizes the update.
    const list = await base44.asServiceRole.entities.CommercialMap.filter({ shareToken }, '-created_date', 1);
    if (!list || !list.length) return Response.json({ error: 'Carte introuvable' }, { status: 404 });
    const map = list[0];

    const update: Record<string, any> = {};
    if (body.overlays !== undefined) update.overlays = await uploadJson(base44, body.overlays, 'overlays.json');
    if (body.mapView !== undefined) update.mapView = body.mapView;
    if (body.departments !== undefined) update.departments = body.departments;
    if (body.markers !== undefined) update.markers = await uploadJson(base44, body.markers, 'markers.json');

    await base44.asServiceRole.entities.CommercialMap.update(map.id, update);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}