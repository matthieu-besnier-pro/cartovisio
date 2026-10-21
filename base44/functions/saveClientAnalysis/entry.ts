import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Save the display settings of a client analysis from a public editable link.
// The shareToken is the shared secret that authorizes the update (same pattern
// as savePublicMap). Only presentation fields can be changed this way — the
// client data itself can only be imported or deleted from the authenticated app.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const shareToken = String(body?.shareToken || '').trim();
    if (!shareToken) return Response.json({ error: 'Jeton manquant' }, { status: 400 });

    const list = await base44.asServiceRole.entities.ClientMap.filter({ shareToken }, '-created_date', 1);
    if (!list || !list.length) return Response.json({ error: 'Analyse introuvable' }, { status: 404 });
    const map = list[0];

    const update: Record<string, any> = {};
    if (body.colorMode !== undefined) update.colorMode = String(body.colorMode);
    if (body.filters !== undefined) update.filters = String(body.filters);
    if (body.mapView !== undefined) update.mapView = String(body.mapView);
    if (body.aiAnalysis !== undefined) update.aiAnalysis = String(body.aiAnalysis);

    await base44.asServiceRole.entities.ClientMap.update(map.id, update);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
