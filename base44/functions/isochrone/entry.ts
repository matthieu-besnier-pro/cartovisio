// Isochrone proxy → public FOSSGIS Valhalla (no API key required).
// https://valhalla1.openstreetmap.de — free, fair-use, OpenStreetMap-based.
// Proxying server-side keeps a proper User-Agent (fair-use policy) and avoids CORS.
//
// Request  : { lat:number, lng:number, profile?:string, minutes?:number[] }
// Response : { geojson: <FeatureCollection>, minutes:number[] } | { error:string }
//
// Output features carry properties.value (seconds) so the frontend can label/sort
// them uniformly (Valhalla natively returns properties.contour in minutes).

const COSTING: Record<string, string> = {
  'driving-car': 'auto',
  'cycling-regular': 'bicycle',
  'foot-walking': 'pedestrian',
};

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const costing = COSTING[body?.profile] || 'auto';

    let minutes: number[] = Array.isArray(body?.minutes)
      ? body.minutes.map(Number).filter((n: number) => n > 0 && n <= 60)
      : [10, 20, 30];
    // Valhalla allows up to 4 contours per request.
    minutes = [...new Set(minutes)].sort((a, b) => a - b).slice(0, 4);
    if (!minutes.length) minutes = [10, 20, 30];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Coordonnées invalides' }, { status: 400 });
    }

    const payload = {
      locations: [{ lat, lon: lng }],
      costing,
      contours: minutes.map((m) => ({ time: m })),
      polygons: true,
      denoise: 0.5,
      generalize: 80,
    };
    const url = 'https://valhalla1.openstreetmap.de/isochrone?json=' + encodeURIComponent(JSON.stringify(payload));

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'CartoVisio/1.0 (Groupe Dubreuil - Pole Agri)',
        Accept: 'application/json',
      },
    });
    if (!r.ok) {
      const t = await r.text();
      return Response.json({ error: `Service isochrone ${r.status}: ${t.slice(0, 300)}` }, { status: 502 });
    }

    const geojson = await r.json();
    (geojson?.features || []).forEach((f: any) => {
      const c = f?.properties?.contour;
      if (c != null && f.properties) f.properties.value = Number(c) * 60;
    });

    return Response.json({ geojson, minutes });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
