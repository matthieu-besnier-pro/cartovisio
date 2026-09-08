// Shared utilities for commercial sector maps

export const PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFD93D", "#C77DFF",
  "#FF8C42", "#6C5CE7", "#00B894", "#E17055", "#74B9FF", "#A29BFE",
  "#FD79A8", "#55EFC4", "#FDCB6E", "#E84393", "#0984E3", "#6AB04C",
  "#F0932B", "#22A6B3", "#BE2EDD", "#009432", "#EA2027", "#12CBC4",
];

export const CATEGORY_PALETTE = ['#16a34a', '#2563eb', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#059669', '#4f46e5'];
const _catColorMap = {};
export function categoryColor(cat) {
  if (!cat) return '#16a34a';
  if (_catColorMap[cat]) return _catColorMap[cat];
  _catColorMap[cat] = CATEGORY_PALETTE[Object.keys(_catColorMap).length % CATEGORY_PALETTE.length];
  return _catColorMap[cat];
}

export const DEPT_SLUGS = {
  '01': 'ain', '02': 'aisne', '03': 'allier', '04': 'alpes-de-haute-provence', '05': 'hautes-alpes',
  '06': 'alpes-maritimes', '07': 'ardeche', '08': 'ardennes', '09': 'ariege', '10': 'aube',
  '11': 'aude', '12': 'aveyron', '13': 'bouches-du-rhone', '14': 'calvados', '15': 'cantal',
  '16': 'charente', '17': 'charente-maritime', '18': 'cher', '19': 'correze', '21': 'cote-d-or',
  '22': 'cotes-d-armor', '23': 'creuse', '24': 'dordogne', '25': 'doubs', '26': 'drome',
  '27': 'eure', '28': 'eure-et-loir', '29': 'finistere', '2A': 'corse-du-sud', '2B': 'haute-corse',
  '30': 'gard', '31': 'haute-garonne', '32': 'gers', '33': 'gironde', '34': 'herault',
  '35': 'ille-et-vilaine', '36': 'indre', '37': 'indre-et-loire', '38': 'isere', '39': 'jura',
  '40': 'landes', '41': 'loir-et-cher', '42': 'loire', '43': 'haute-loire', '44': 'loire-atlantique',
  '45': 'loiret', '46': 'lot', '47': 'lot-et-garonne', '48': 'lozere', '49': 'maine-et-loire',
  '50': 'manche', '51': 'marne', '52': 'haute-marne', '53': 'mayenne', '54': 'meurthe-et-moselle',
  '55': 'meuse', '56': 'morbihan', '57': 'moselle', '58': 'nievre', '59': 'nord',
  '60': 'oise', '61': 'orne', '62': 'pas-de-calais', '63': 'puy-de-dome', '64': 'pyrenees-atlantiques',
  '65': 'hautes-pyrenees', '66': 'pyrenees-orientales', '67': 'bas-rhin', '68': 'haut-rhin',
  '69': 'rhone', '70': 'haute-saone', '71': 'saone-et-loire', '72': 'sarthe', '73': 'savoie',
  '74': 'haute-savoie', '75': 'paris', '76': 'seine-maritime', '77': 'seine-et-marne',
  '78': 'yvelines', '79': 'deux-sevres', '80': 'somme', '81': 'tarn', '82': 'tarn-et-garonne',
  '83': 'var', '84': 'vaucluse', '85': 'vendee', '86': 'vienne', '87': 'haute-vienne',
  '88': 'vosges', '89': 'yonne', '90': 'territoire-de-belfort', '91': 'essonne',
  '92': 'hauts-de-seine', '93': 'seine-saint-denis', '94': 'val-de-marne', '95': 'val-d-oise',
};

export const TILES = {
  'google-maps': { url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', opts: { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google' } },
  'google-satellite': { url: 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', opts: { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google' } },
  'osm': { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { maxZoom: 19, attribution: '© OpenStreetMap' } },
  'carto-dark': { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', opts: { maxZoom: 19, attribution: '© CartoDB' } },
  'carto-light': { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', opts: { maxZoom: 19, attribution: '© CartoDB' } },
  'none': null,
};

export function genShareToken() {
  return 'map_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Fetch commune geometries for a department from geo.api.gouv.fr
// Returns an object { code: feature } merged into provided geoData
export async function fetchDeptGeo(dept, geoData, deptLoaded) {
  if (deptLoaded.has(dept)) return;
  try {
    const r = await fetch(`https://geo.api.gouv.fr/departements/${dept}/communes?geometry=contour&format=geojson&type=commune-actuelle`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const gj = await r.json();
    gj.features.forEach(f => { geoData[f.properties.code] = f; });
    deptLoaded.add(dept);
  } catch (e) {
    console.warn('Dept geo err:', dept, e.message);
    deptLoaded.add(dept);
  }
}

// Fetch department boundary (outer contour) from gregoiredavid/france-geojson
export async function fetchDeptBoundary(dept, deptGeoData, deptGeoLoaded) {
  if (deptGeoLoaded.has(dept)) return;
  const slug = DEPT_SLUGS[dept];
  if (!slug) { deptGeoLoaded.add(dept); return; }
  const url = `https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements/${dept}-${slug}/departement-${dept}-${slug}.geojson`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const gj = await r.json();
    if (gj.type === 'Feature') deptGeoData[dept] = gj;
    else if (gj.features && gj.features.length) deptGeoData[dept] = gj.features[0];
    deptGeoLoaded.add(dept);
  } catch (e) {
    console.warn('Dept boundary err:', dept, e.message);
    deptGeoLoaded.add(dept);
  }
}

// Fetch canton boundaries for a department (gregoiredavid/france-geojson)
export async function fetchCantons(dept, cantonGeoData, cantonGeoLoaded) {
  if (cantonGeoLoaded.has(dept)) return;
  const slug = DEPT_SLUGS[dept];
  if (!slug) { cantonGeoLoaded.add(dept); return; }
  const url = `https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements/${dept}-${slug}/cantons-${dept}-${slug}.geojson`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const gj = await r.json();
    cantonGeoData[dept] = gj;
    cantonGeoLoaded.add(dept);
  } catch (e) {
    console.warn('Cantons err:', dept, e.message);
    cantonGeoLoaded.add(dept);
  }
}

// ── HTML import (re-use an existing map HTML file) ──
// Extracts the code→vendeur assignments embedded in an old map HTML.
function matchBraces(text, start) {
  let depth = 0, inStr = false, q = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === q) inStr = false;
    } else {
      if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; }
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
  }
  return null;
}

function scoreCV(obj) {
  let score = 0;
  for (const [k, v] of Object.entries(obj)) {
    const code = String(k).trim().replace(/\.0$/, '').padStart(5, '0');
    if (/^[0-9A-Z]{5}$/.test(code) && typeof v === 'string' && v.trim() && !/^\d+$/.test(v.trim())) score++;
  }
  return score;
}

function extractCVFromText(text, log) {
  const candidates = [];
  const assignRe = /(?:var|let|const)?\s*["']?(\w+)["']?\s*[:=]\s*(\{)/g;
  let m;
  while ((m = assignRe.exec(text)) !== null) {
    const bracePos = m.index + m[0].length - 1;
    const objStr = matchBraces(text, bracePos);
    if (objStr) candidates.push({ name: m[1], str: objStr });
  }
  const scriptRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(text)) !== null) {
    const t = m[1].trim();
    if (t.startsWith('{')) { const objStr = matchBraces(t, 0); if (objStr) candidates.push({ name: 'json-script', str: objStr }); }
  }
  let best = null, bestScore = 0;
  for (const cand of candidates) {
    let parsed;
    try { parsed = JSON.parse(cand.str); } catch { continue; }
    if (Array.isArray(parsed)) {
      const map = {};
      let arrScore = 0;
      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue;
        const code = String(row.code || row.code_insee || row.insee || row.commune || '').trim().replace(/\.0$/, '').padStart(5, '0');
        const vendeur = String(row.vendeur || row.commercial || row.secteur || row.value || row.nom || '').trim();
        if (/^[0-9A-Z]{5}$/.test(code) && vendeur && !/^\d+$/.test(vendeur)) { map[code] = vendeur; arrScore++; }
      }
      if (arrScore > bestScore) { best = map; bestScore = arrScore; }
    } else if (parsed && typeof parsed === 'object') {
      const score = scoreCV(parsed);
      if (score > bestScore) { best = parsed; bestScore = score; }
      for (const [, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const s2 = scoreCV(v);
          if (s2 > bestScore) { best = v; bestScore = s2; }
        }
      }
    }
  }
  if (best && bestScore > 0) {
    const out = {};
    for (const [k, v] of Object.entries(best)) {
      const code = String(k).trim().replace(/\.0$/, '').padStart(5, '0');
      if (typeof v === 'string' && v.trim()) out[code] = v.trim();
    }
    log(`Bloc de données détecté (${bestScore} affectations)`, 'ok');
    return out;
  }
  return null;
}

// ── Markers (Pôle Agri) extraction from HTML ──
function cleanPopupText(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
const AGRI_RE = /agri|p[oô]le|coop|silo|négoc|negoc|créal|creal|éleveur|eleveur|matériel|materiel|semence|ferme|exploit|stockage|grain/i;
function collectPoint(it, add) {
  if (!it || typeof it !== 'object') return;
  const lat = it.lat ?? it.latitude ?? (it.latlng && it.latlng[0]) ?? (it.center && it.center[0])
    ?? (it.geometry && it.geometry.type === 'Point' ? it.geometry.coordinates[1] : null)
    ?? (it.properties && (it.properties.lat || it.properties.latitude)) ?? null;
  const lng = it.lng ?? it.longitude ?? it.lon ?? it.lnglon ?? (it.latlng && it.latlng[1]) ?? (it.center && it.center[1])
    ?? (it.geometry && it.geometry.type === 'Point' ? it.geometry.coordinates[0] : null)
    ?? (it.properties && (it.properties.lng || it.properties.longitude)) ?? null;
  const name = it.name || it.label || it.title || it.nom || it.popup
    || (it.properties && (it.properties.name || it.properties.nom || it.properties.title)) || '';
  if (lat != null && lng != null) add(parseFloat(lat), parseFloat(lng), cleanPopupText(String(name)));
}
export function extractMarkersFromText(text, log) {
  const all = [];
  const seen = new Set();
  const add = (lat, lng, name) => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push({ id: 'pa_' + all.length + '_' + Math.random().toString(36).slice(2, 6), lat, lng, name: (name || 'Pôle Agri').trim() });
  };
  let m;
  const markerRe = /L\.marker\(\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
  while ((m = markerRe.exec(text)) !== null) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    const after = text.slice(m.index, m.index + 500);
    let name = '';
    const popMatch = after.match(/(?:bindPopup|bindTooltip)\s*\(\s*(["'`])([\s\S]*?)\1/);
    if (popMatch) name = cleanPopupText(popMatch[2]);
    add(lat, lng, name);
  }
  const cmRe = /L\.circleMarker\(\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
  while ((m = cmRe.exec(text)) !== null) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    const after = text.slice(m.index, m.index + 500);
    let name = '';
    const popMatch = after.match(/(?:bindPopup|bindTooltip)\s*\(\s*(["'`])([\s\S]*?)\1/);
    if (popMatch) name = cleanPopupText(popMatch[2]);
    add(lat, lng, name);
  }
  const scriptRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(text)) !== null) {
    let parsed;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    const items = Array.isArray(parsed) ? parsed
      : (parsed.features || parsed.markers || parsed.points || (Array.isArray(parsed.data) ? parsed.data : null));
    if (items) items.forEach(it => collectPoint(it, add));
    else if (parsed && parsed.geometry && parsed.geometry.type === 'Point') collectPoint(parsed, add);
  }
  const assignRe = /(?:var|let|const)\s+\w+\s*=\s*(\[[\s\S]*?\]);/g;
  while ((m = assignRe.exec(text)) !== null) {
    let arr;
    try { arr = JSON.parse(m[1]); } catch { continue; }
    if (Array.isArray(arr)) arr.forEach(it => collectPoint(it, add));
  }
  const agri = all.filter(mk => AGRI_RE.test(mk.name));
  const result = agri.length ? agri : all;
  if (result.length && log) log(`📍 ${result.length} marqueurs Pôle Agri détectés`, 'ok');
  return result;
}

export async function processHtmlFile(file, onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  log(`📂 ${file.name}`);
  const text = await file.text();
  log(`${text.length} caractères lus`);
  const cV = extractCVFromText(text, log);
  const markers = extractMarkersFromText(text, log);
  if ((!cV || !Object.keys(cV).length) && !markers.length) {
    throw new Error('Aucune donnée trouvée dans le HTML (ni secteurs ni marqueurs). Vérifiez le fichier.');
  }
  const departments = cV && Object.keys(cV).length ? [...new Set(Object.keys(cV).map(c => c.slice(0, 2)))] : [];
  if (Object.keys(cV || {}).length) log(`✅ ${Object.keys(cV).length} communes extraites`, 'ok');
  const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  return { name, cV: cV || {}, departments, markers };
}

// Ensure every vendeur in an overlay has a color assigned
export function ensureOverlayColors(overlay, startIdx = 0) {
  if (!overlay.vColors) overlay.vColors = {};
  let idx = startIdx;
  const vendors = [...new Set(Object.values(overlay.cV || {}))];
  vendors.forEach(v => {
    if (!overlay.vColors[v]) overlay.vColors[v] = PALETTE[idx % PALETTE.length];
    idx++;
  });
  return overlay;
}

// Merge all visible overlays into a flat code->vendeur map and vendeur->color map
export function syncCV(overlays) {
  const cV = {};
  const vColors = {};
  overlays.forEach(o => {
    if (!o.visible) return;
    Object.assign(cV, o.cV || {});
    Object.assign(vColors, o.vColors || {});
  });
  return { cV, vColors };
}

// Count communes per vendeur for an overlay
export function countByVendeur(overlay) {
  const counts = {};
  Object.values(overlay.cV || {}).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return counts;
}

// ── Excel import ──
// Returns { name, cV, departments, log }
export async function processExcelFile(file, codeType = 'auto', onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  log(`📂 ${file.name}`);
  const buf = await file.arrayBuffer();
  const XLSX = window.XLSX;
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  log(`${rows.length} lignes lues`);

  const sr = isNaN(parseInt(rows[0]?.[0])) ? 1 : 0;
  if (sr) log('En-tête ignorée');
  const headerA = sr ? String(rows[0][0] || '').toLowerCase() : '';
  const headerB = sr ? String(rows[0][1] || '') : '';

  // Auto-detect code type
  if (codeType === 'auto') {
    if (headerA.includes('postal') || headerA.includes('cp') || headerA === 'code postal') {
      codeType = 'postal'; log('📮 En-tête "' + rows[0][0] + '" → codes postaux', 'ok');
    } else if (headerA.includes('insee') || headerA.includes('commune')) {
      codeType = 'insee'; log('🏛 En-tête "' + rows[0][0] + '" → codes INSEE', 'ok');
    } else {
      const sample = [];
      for (let i = sr; i < Math.min(rows.length, 20); i++) {
        if (rows[i]?.[0]) sample.push(String(rows[i][0]).trim().replace(/\.0$/, '').padStart(5, '0'));
      }
      const endsIn0 = sample.filter(c => c.endsWith('0')).length;
      const endsIn00 = sample.filter(c => c.endsWith('00')).length;
      if (endsIn00 > sample.length * 0.15 || endsIn0 > sample.length * 0.5) {
        codeType = 'postal'; log('🔍 Détecté : codes postaux (pattern)', 'ok');
      } else {
        codeType = 'insee'; log('🔍 Détecté : codes INSEE (pattern)', 'ok');
      }
    }
  }

  // Detect 3-column format: Code | Commune | Value
  let hasNameCol = false;
  const maxCols = Math.max(...rows.slice(sr, Math.min(rows.length, 20)).map(r => r ? r.length : 0));
  if (maxCols >= 3) {
    let bText = 0, cNum = 0;
    for (let i = sr; i < Math.min(rows.length, 20); i++) {
      const row = rows[i]; if (!row) continue;
      if (row[1] != null && isNaN(Number(row[1]))) bText++;
      if (row[2] != null && !isNaN(Number(row[2]))) cNum++;
    }
    hasNameCol = (bText > 3 && cNum > 3);
  }

  const rawEntries = [];
  let skip = 0;
  for (let i = sr; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) { skip++; continue; }
    let code = String(row[0]).trim().replace(/\.0$/, '');
    let v, vStr, communeName = null;
    if (hasNameCol) {
      communeName = row[1] ? String(row[1]).trim() : null;
      v = row[2]; vStr = v != null ? String(v).trim() : '';
    } else {
      v = row[1]; vStr = v != null ? String(v).trim() : '';
    }
    if (!code || !vStr || vStr === 'undefined' || vStr === 'null') { skip++; continue; }
    code = code.padStart(5, '0');
    if (code.length !== 5 || isNaN(parseInt(code))) { skip++; continue; }
    rawEntries.push({ code, raw: v, vendeur: vStr, commune: communeName });
  }
  if (!rawEntries.length) { log('⚠ Aucune donnée valide', 'err'); throw new Error('Aucune donnée valide'); }
  log(`${rawEntries.length} lignes valides`);

  // If column B is numeric → not a sector import (analysis), reject for now
  const numericCount = rawEntries.filter(e => typeof e.raw === 'number' || (!isNaN(Number(e.raw)) && String(e.raw).trim() !== '')).length;
  const isColBNumeric = numericCount > rawEntries.length * 0.8;
  if (isColBNumeric) {
    throw new Error('La colonne valeur est numérique. Pour les secteurs, utilisez un nom de commercial en colonne B.');
  }

  const usePostal = (codeType === 'postal');
  const hasNames = rawEntries.some(e => e.commune);
  const nd = {};
  let ok = 0;

  if (usePostal) {
    log('📮 Résolution des codes postaux...');
    const postalCache = {};
    const uniqueCPs = [...new Set(rawEntries.map(e => e.code))];
    let resolved = 0;
    for (let i = 0; i < uniqueCPs.length; i++) {
      const cp = uniqueCPs[i];
      try {
        const r = await fetch('https://geo.api.gouv.fr/communes?codePostal=' + cp + '&fields=code,nom');
        if (r.ok) { postalCache[cp] = await r.json(); if (postalCache[cp].length) resolved++; }
        else postalCache[cp] = [];
      } catch (e) { postalCache[cp] = []; }
    }
    log(`✓ ${resolved}/${uniqueCPs.length} CP résolus`, 'ok');
    if (hasNames) {
      const normalize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-']/g, ' ').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
      for (const { code, vendeur, commune } of rawEntries) {
        const communes = postalCache[code] || [];
        const norm = normalize(commune);
        const match = communes.find(c => normalize(c.nom) === norm)
          || communes.find(c => normalize(c.nom).includes(norm) || norm.includes(normalize(c.nom)));
        if (match) { nd[match.code] = vendeur; ok++; }
        else { communes.forEach(c => { nd[c.code] = vendeur; ok++; }); }
      }
    } else {
      for (const { code, vendeur } of rawEntries) {
        (postalCache[code] || []).map(c => c.code).forEach(ic => { nd[ic] = vendeur; ok++; });
      }
    }
    log(`→ ${ok} communes affectées`, 'ok');
  } else {
    for (const { code, vendeur } of rawEntries) { nd[code] = vendeur; ok++; }
    log(`✓ ${ok} communes`, 'ok');
  }
  if (skip) log(`⚠ ${skip} lignes ignorées`, 'err');

  const departments = [...new Set(Object.keys(nd).map(c => c.slice(0, 2)))];
  const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  return { name, cV: nd, departments };
}

// ── JSON import ──
export async function processJsonFile(file, onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  log(`📂 ${file.name}`);
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { throw new Error('JSON invalide : ' + e.message); }
  const cV = {};
  const markers = [];
  const addMarker = (lat, lng, name, category) => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return;
    markers.push({ id: 'pa_' + markers.length + '_' + Math.random().toString(36).slice(2, 6), lat: la, lng: ln, name: (name || 'Pôle Agri').trim(), category: (category || '').trim() });
  };
  const tryRow = (row) => {
    if (!row || typeof row !== 'object') return;
    const code = String(row.code || row.code_insee || row.insee || row.commune || '').trim().replace(/\.0$/, '').padStart(5, '0');
    const vendeur = String(row.vendeur || row.commercial || row.secteur || row.value || '').trim();
    if (/^[0-9A-Z]{5}$/.test(code) && vendeur && !/^\d+$/.test(vendeur)) cV[code] = vendeur;
    const lat = row.lat ?? row.latitude;
    const lng = row.lng ?? row.lon ?? row.longitude;
    if (lat != null && lng != null) addMarker(lat, lng, row.name || row.nom || row.title || '', row.category || row.folder || row.layer || row.groupe || '');
  };
  if (Array.isArray(parsed)) {
    parsed.forEach(tryRow);
  } else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    parsed.features.forEach(f => {
      const g = f.geometry || {};
      const props = f.properties || {};
      if (g.type === 'Point') {
        const [lng, lat] = g.coordinates || [];
        addMarker(lat, lng, props.name || props.nom || props.title || '', props.category || props.folder || props.layer || props.groupe || '');
      } else if (props.vendeur || props.commercial) {
        const code = String(props.code || props.code_insee || props.insee || '').trim().replace(/\.0$/, '').padStart(5, '0');
        if (/^[0-9A-Z]{5}$/.test(code)) cV[code] = String(props.vendeur || props.commercial).trim();
      }
    });
  } else if (parsed && typeof parsed === 'object') {
    let score = 0;
    for (const [k, v] of Object.entries(parsed)) {
      const code = String(k).trim().replace(/\.0$/, '').padStart(5, '0');
      if (/^[0-9A-Z]{5}$/.test(code) && typeof v === 'string' && v.trim() && !/^\d+$/.test(v.trim())) { cV[code] = v.trim(); score++; }
    }
    if (!score) {
      for (const key of ['markers', 'points', 'data', 'communes']) {
        if (Array.isArray(parsed[key])) { parsed[key].forEach(tryRow); break; }
      }
    }
  }
  if (!Object.keys(cV).length && !markers.length) throw new Error('Aucune donnée exploitable dans le JSON (secteurs ou marqueurs).');
  if (Object.keys(cV).length) log(`✅ ${Object.keys(cV).length} communes`, 'ok');
  if (markers.length) log(`📍 ${markers.length} marqueurs`, 'ok');
  const departments = Object.keys(cV).length ? [...new Set(Object.keys(cV).map(c => c.slice(0, 2)))] : [];
  const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  return { name, cV, departments, markers };
}

// ── KML / KMZ / GPX import (markers) ──
function extractKmlMarkers(text, log) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const out = [];
  const seen = new Set();
  const add = (lat, lng, name, category) => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return;
    const key = `${la.toFixed(4)},${ln.toFixed(4)}`;
    if (seen.has(key)) return; seen.add(key);
    out.push({ id: 'pa_' + out.length + '_' + Math.random().toString(36).slice(2, 6), lat: la, lng: ln, name: (name || 'Pôle Agri').trim(), category: (category || '').trim() });
  };
  const folderNameOf = (pm) => {
    let el = pm.parentElement;
    while (el) {
      if (el.tagName === 'Folder') {
        const nm = el.getElementsByTagName('name')[0]?.textContent?.trim();
        if (nm) return nm;
      }
      el = el.parentElement;
    }
    return '';
  };
  const placemarks = doc.getElementsByTagName('Placemark');
  for (const pm of Array.from(placemarks)) {
    const name = pm.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    const category = folderNameOf(pm);
    const points = pm.getElementsByTagName('Point');
    for (const pt of Array.from(points)) {
      const coords = pt.getElementsByTagName('coordinates')[0]?.textContent?.trim();
      if (!coords) continue;
      const first = coords.split(/\s+/)[0].split(',');
      add(first[1], first[0], name, category);
    }
  }
  if (out.length && log) log(`📍 ${out.length} marqueurs extraits du KML`, 'ok');
  return out;
}

export async function processKmlFile(file, onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  log(`📂 ${file.name}`);
  const text = await file.text();
  const markers = extractKmlMarkers(text, log);
  if (!markers.length) throw new Error('Aucun point (Placemark/Point) trouvé dans le KML.');
  const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  return { name, cV: {}, departments: [], markers };
}

async function inflateRaw(chunk) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(chunk);
  writer.close();
  const parts = [];
  let r;
  while (!(r = await reader.read()).done) parts.push(r.value);
  return new Blob(parts).text();
}

async function extractKmlFromKmz(buf) {
  const view = new DataView(buf);
  let off = 0;
  while (off < buf.byteLength - 30) {
    if (view.getUint32(off, true) !== 0x04034b50) break;
    const method = view.getUint16(off + 8, true);
    const compSize = view.getUint32(off + 18, true);
    const fnLen = view.getUint16(off + 26, true);
    const extraLen = view.getUint16(off + 28, true);
    const fnStart = off + 30;
    const name = new TextDecoder().decode(new Uint8Array(buf, fnStart, fnLen)).toLowerCase();
    const dataStart = fnStart + fnLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (name.endsWith('.kml')) {
      if (method === 0) return new TextDecoder().decode(new Uint8Array(buf, dataStart, compSize));
      if (method === 8 && typeof DecompressionStream !== 'undefined') return await inflateRaw(new Uint8Array(buf, dataStart, compSize));
      throw new Error('KMZ compressé non lisible par ce navigateur.');
    }
    off = dataEnd;
  }
  return null;
}

export async function processKmzFile(file, onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  log(`📂 ${file.name}`);
  const buf = await file.arrayBuffer();
  const kmlText = await extractKmlFromKmz(buf);
  if (!kmlText) throw new Error('Aucun fichier .kml trouvé dans le KMZ.');
  const markers = extractKmlMarkers(kmlText, log);
  if (!markers.length) throw new Error('Aucun point trouvé dans le KMZ.');
  const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  return { name, cV: {}, departments: [], markers };
}

export async function processGpxFile(file, onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  log(`📂 ${file.name}`);
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const out = [];
  const seen = new Set();
  for (const w of Array.from(doc.getElementsByTagName('wpt'))) {
    const la = parseFloat(w.getAttribute('lat'));
    const ln = parseFloat(w.getAttribute('lon'));
    if (isNaN(la) || isNaN(ln)) continue;
    const key = `${la.toFixed(4)},${ln.toFixed(4)}`;
    if (seen.has(key)) continue; seen.add(key);
    const name = w.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    out.push({ id: 'pa_' + out.length + '_' + Math.random().toString(36).slice(2, 6), lat: la, lng: ln, name: (name || 'Pôle Agri').trim() });
  }
  if (out.length && log) log(`📍 ${out.length} marqueurs extraits du GPX`, 'ok');
  if (!out.length) throw new Error('Aucun waypoint (<wpt>) trouvé dans le GPX.');
  const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  return { name, cV: {}, departments: [], markers: out };
}

// ── Export helpers ──

function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }

function project(lat, lng, b, scale) {
  const x = (lng - b.minLng) * Math.PI / 180 * scale;
  const y = (mercY(b.maxLat) - mercY(lat)) * scale;
  return [x, y];
}

function featurePath(feature, b, scale) {
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let d = '';
  polys.forEach(poly => poly.forEach(ring => {
    ring.forEach((c, i) => {
      const [x, y] = project(c[1], c[0], b, scale);
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`;
    });
    d += 'Z';
  }));
  return d;
}

export function buildSVG(overlays, geoData, { bordersOn = true, maxDim = 2000, title = 'Carte Secteurs Commerciaux', accent = '#f43f5e' } = {}) {
  const { cV, vColors } = syncCV(overlays);
  if (!Object.keys(cV).length) return null;

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  Object.keys(cV).forEach(code => {
    const f = geoData[code]; if (!f) return;
    const L = window.L;
    const bb = L.geoJSON(f).getBounds();
    minLat = Math.min(minLat, bb.getSouth()); maxLat = Math.max(maxLat, bb.getNorth());
    minLng = Math.min(minLng, bb.getWest()); maxLng = Math.max(maxLng, bb.getEast());
  });
  const pad = 0.03;
  const b = {
    minLat: minLat - (maxLat - minLat) * pad, maxLat: maxLat + (maxLat - minLat) * pad,
    minLng: minLng - (maxLng - minLng) * pad, maxLng: maxLng + (maxLng - minLng) * pad,
  };
  const lngRad = (b.maxLng - b.minLng) * Math.PI / 180;
  const mercSpan = mercY(b.maxLat) - mercY(b.minLat);
  let scale, mapW, mapH;
  if (lngRad >= mercSpan) { scale = maxDim / lngRad; } else { scale = maxDim / mercSpan; }
  mapW = Math.round(lngRad * scale);
  mapH = Math.round(mercSpan * scale);

  const counts = {};
  Object.values(cV).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const vendeurs = Object.keys(counts).sort();
  const LW = 200, LP = 14, LI = 23;
  const LH = LP * 2 + 28 + vendeurs.length * LI;

  const byV = {};
  Object.entries(cV).forEach(([code, vendeur]) => {
    const f = geoData[code]; if (!f) return;
    if (!byV[vendeur]) byV[vendeur] = [];
    byV[vendeur].push({ code, f });
  });
  let groups = '';
  Object.entries(byV).forEach(([vendeur, items]) => {
    const c = vColors[vendeur] || '#888';
    let paths = '';
    items.forEach(({ code, f }) => { const d = featurePath(f, b, scale); if (d) paths += `<path d="${d}" data-code="${code}"/>\n`; });
    const strokeColor = bordersOn ? '#fff' : c;
    const strokeW = bordersOn ? '.45' : '0';
    groups += `<g fill="${c}" fill-opacity=".72" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linejoin="round" shape-rendering="geometricPrecision">\n${paths}</g>\n`;
  });

  const LX = mapW - LW - 18, LY = 18;
  let legItems = '';
  vendeurs.forEach((n, i) => {
    const y = LP + 28 + i * LI;
    legItems += `<rect x="${LP}" y="${y}" width="13" height="13" fill="${vColors[n] || '#888'}" rx="2"/>\n<text x="${LP + 20}" y="${y + 10}" fill="#e0e0e0" font-size="11.5" font-family="Arial,Helvetica,sans-serif">${escapeXml(n)}</text>\n<text x="${LW - LP}" y="${y + 10}" fill="#7ec8e3" font-size="10.5" font-family="Arial,Helvetica,sans-serif" text-anchor="end">${counts[n]}</text>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapW} ${mapH}" width="${mapW}" height="${mapH}">
<rect width="${mapW}" height="${mapH}" fill="#e8e4d8"/>
${groups}
<g transform="translate(${LX},${LY})">
  <rect width="${LW}" height="${LH}" rx="8" fill="#16213e" fill-opacity=".94"/>
  <rect width="${LW}" height="28" rx="8" fill="${accent}"/>
  <rect y="20" width="${LW}" height="14" fill="${accent}"/>
  <text x="${LP}" y="20" fill="white" font-size="10.5" font-weight="bold" letter-spacing="1.5" font-family="Arial,Helvetica,sans-serif">SECTEURS COMMERCIAUX</text>
  ${legItems}
</g>
<g transform="translate(18,18)">
  <rect width="270" height="33" rx="6" fill="#16213e" fill-opacity=".94"/>
  <text x="13" y="21" fill="white" font-size="13.5" font-weight="bold" font-family="Arial,Helvetica,sans-serif">${escapeXml(title)}</text>
</g>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function exportSVGFile(overlays, geoData, opts) {
  const svg = buildSVG(overlays, geoData, opts);
  if (!svg) return false;
  dlFile('secteurs.svg', svg, 'image/svg+xml');
  return true;
}

export function exportPNGFile(overlays, geoData, opts) {
  const svg = buildSVG(overlays, geoData, { ...opts, maxDim: 2400 });
  if (!svg) return false;
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  const pW = m ? parseInt(m[1]) : 2400, pH = m ? parseInt(m[2]) : 1800;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = pW; canvas.height = pH;
    canvas.getContext('2d').drawImage(img, 0, 0, pW, pH);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => dlFile('secteurs_HD.png', b, 'image/png', true), 'image/png', 1);
  };
  img.src = url;
  return true;
}

export function exportGeoJSONFile(overlays, geoData) {
  const { cV, vColors } = syncCV(overlays);
  const features = [];
  Object.entries(cV).forEach(([code, vendeur]) => {
    const f = geoData[code]; if (!f) return;
    const ff = JSON.parse(JSON.stringify(f));
    ff.properties.vendeur = vendeur;
    ff.properties.couleur = vColors[vendeur] || '#888';
    features.push(ff);
  });
  dlFile('secteurs.geojson', JSON.stringify({ type: 'FeatureCollection', features }, null, 2), 'application/json');
}

export function exportExcelFile(overlays, geoData) {
  const { cV } = syncCV(overlays);
  const rows = [['Code commune', 'Vendeur', 'Nom commune', 'Département']];
  const entries = Object.entries(cV).map(([code, vendeur]) => {
    const nom = geoData[code]?.properties?.nom || '';
    const dept = code.slice(0, 2);
    return [code, vendeur, nom, dept];
  });
  entries.sort((a, b) => a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
  entries.forEach(r => rows.push(r));
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Communes');
  const counts = {};
  entries.forEach(([, vendeur]) => { counts[vendeur] = (counts[vendeur] || 0) + 1; });
  const summaryRows = [['Vendeur', 'Nb communes']];
  Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([v, n]) => summaryRows.push([v, n]));
  summaryRows.push(['', ''], ['TOTAL', entries.length]);
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Résumé');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  dlFile('secteurs_commerciaux.xlsx', new Blob([buf], { type: 'application/octet-stream' }), '', true);
}

function dlFile(name, data, type, isBlob = false) {
  const a = document.createElement('a');
  a.href = isBlob ? URL.createObjectURL(data) : URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Serialize / deserialize map state for DB storage
export function serializeOverlays(overlays) {
  return JSON.stringify(overlays.map(o => ({
    id: o.id, name: o.name, cV: o.cV, vColors: o.vColors, opacity: o.opacity, visible: o.visible,
  })));
}

export function parseOverlays(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export function serializeMapView(lat, lng, zoom) {
  return JSON.stringify({ lat, lng, zoom });
}

export function parseMapView(json) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export function parseDepartments(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export function serializeMarkers(markers) {
  return JSON.stringify((markers || []).map(m => ({ id: m.id, lat: m.lat, lng: m.lng, name: m.name })));
}

export function parseMarkers(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}