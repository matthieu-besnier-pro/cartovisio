// Isochrone proxy → OpenRouteService.
// Keeps the ORS API key server-side (secret ORS_API_KEY) so it is never exposed
// to the browser, and works for anonymous public-map viewers too.
//
// Request  : { lat:number, lng:number, profile?:string, minutes?:number[] }
// Response : { geojson: <FeatureCollection> } | { error: string }

const PROFILES = ['driving-car', 'cycling-regular', 'foot-walking'];

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const profile = PROFILES.includes(body?.profile) ? body.profile : 'driving-car';

    let minutes: number[] = Array.isArray(body?.minutes)
      ? body.minutes.map(Number).filter((n: number) => n > 0 && n <= 60)
      : [10, 20, 30];
    minutes = [...new Set(minutes)].sort((a, b) => a - b).slice(0, 5);
    if (!minutes.length) minutes = [10, 20, 30];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Coordonnées invalides' }, { status: 400 });
    }

    const key = Deno.env.get('ORS_API_KEY');
    if (!key) {
      return Response.json(
        { error: "Clé OpenRouteService manquante. Ajoutez le secret ORS_API_KEY dans Base44 (Settings → Secrets)." },
        { status: 500 },
      );
    }

    const r = await fetch(`https://api.openrouteservice.org/v2/isochrones/${profile}`, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json',
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: minutes.map((m) => m * 60),
        range_type: 'time',
        location_type: 'start',
        smoothing: 25,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return Response.json({ error: `OpenRouteService ${r.status}: ${t.slice(0, 400)}` }, { status: 502 });
    }

    const geojson = await r.json();
    return Response.json({ geojson, minutes });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
