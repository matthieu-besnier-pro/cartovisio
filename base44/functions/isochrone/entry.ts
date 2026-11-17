// Isochrone proxy → public FOSSGIS Valhalla (no API key required).
// https://valhalla1.openstreetmap.de — free, fair-use, OpenStreetMap-based.
//
// The public instance caps a single request at 60 minutes and 1 location.
// Longer ranges are approximated by expansion: compute the 60-minute area,
// sample points along its boundary, then compute the remaining time from each
// of those points. All resulting polygons are merged into ONE MultiPolygon
// feature so overlapping areas render as a single flat shape.
//
// Request  : { lat, lng, profile?, minutes?: number[] }   (minutes ≤ 120)
// Response : { geojson: FeatureCollection, minutes }      features carry
//            properties.value (seconds) and properties.approx for expansions.

const COSTING: Record<string, string> = {
  'driving-car': 'auto',
  'cycling-regular': 'bicycle',
  'foot-walking': 'pedestrian',
};

const ENDPOINT = 'https://valhalla1.openstreetmap.de/isochrone';
const MAX_SINGLE = 60;   // hard server-side limit of the public instance
const MAX_TOTAL = 120;   // what we are willing to approximate up to
const BOUNDARY_POINTS = 10;
const CONCURRENCY = 4;

async function valhalla(lat: number, lon: number, costing: string, contours: number[]) {
  const payload = {
    locations: [{ lat, lon }],
    costing,
    contours: contours.map((t) => ({ time: t })),
    polygons: true,
    denoise: 0.5,
    generalize: 80,
  };
  const r = await fetch(`${ENDPOINT}?json=${encodeURIComponent(JSON.stringify(payload))}`, {
    headers: {
      'User-Agent': 'CartoVisio/1.0 (Groupe Dubreuil - Pole Agri)',
      Accept: 'application/json',
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Service isochrone ${r.status}: ${t.slice(0, 200)}`);
  }
  return await r.json();
}

// Flatten a FeatureCollection into a list of Polygon coordinate arrays.
function polygonsOf(fc: any): any[] {
  const out: any[] = [];
  (fc?.features || []).forEach((f: any) => {
    const g = f?.geometry;
    if (!g) return;
    if (g.type === 'Polygon') out.push(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p: any) => out.push(p));
  });
  return out;
}

// Evenly spaced points along the largest exterior ring.
function samplePoints(polys: any[], k: number) {
  let ring: any[] = [];
  polys.forEach((p) => { if (p?.[0] && p[0].length > ring.length) ring = p[0]; });
  const pts: { lat: number; lon: number }[] = [];
  if (!ring.length) return pts;
  const step = Math.max(1, Math.floor(ring.length / k));
  for (let i = 0; i < ring.length && pts.length < k; i += step) {
    const [lon, lat] = ring[i] || [];
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon });
  }
  return pts;
}

// Run tasks with a small concurrency cap — the public service is fair-use.
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const costing = COSTING[body?.profile] || 'auto';

    let minutes: number[] = Array.isArray(body?.minutes)
      ? body.minutes.map(Number).filter((n: number) => n > 0 && n <= MAX_TOTAL)
      : [10, 20, 30];
    minutes = [...new Set(minutes)].sort((a, b) => a - b).slice(0, 4);
    if (!minutes.length) minutes = [10, 20, 30];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Coordonnées invalides' }, { status: 400 });
    }

    const direct = minutes.filter((m) => m <= MAX_SINGLE);
    const extended = minutes.filter((m) => m > MAX_SINGLE);
    const features: any[] = [];

    if (direct.length) {
      const fc = await valhalla(lat, lng, costing, direct);
      features.push(...(fc?.features || []));
    }

    if (extended.length) {
      // One shared 60-minute base, then expand from its boundary.
      const baseFc = await valhalla(lat, lng, costing, [MAX_SINGLE]);
      const basePolys = polygonsOf(baseFc);
      const pts = samplePoints(basePolys, BOUNDARY_POINTS);

      for (const m of extended) {
        const remaining = Math.min(MAX_SINGLE, m - MAX_SINGLE);
        const rings = [...basePolys];
        if (pts.length) {
          const results = await mapLimit(pts, CONCURRENCY, (p) =>
            valhalla(p.lat, p.lon, costing, [remaining]).catch(() => null)
          );
          results.forEach((fc) => { if (fc) rings.push(...polygonsOf(fc)); });
        }
        features.push({
          type: 'Feature',
          properties: { contour: m, value: m * 60, approx: true },
          geometry: { type: 'MultiPolygon', coordinates: rings },
        });
      }
    }

    // Normalise: every feature exposes properties.value in seconds.
    features.forEach((f: any) => {
      const c = f?.properties?.contour;
      if (c != null && f.properties && f.properties.value == null) f.properties.value = Number(c) * 60;
    });

    return Response.json({ geojson: { type: 'FeatureCollection', features }, minutes });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
