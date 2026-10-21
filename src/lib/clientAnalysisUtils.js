// Utilities for the client-analysis map (geolocated customer base).
//
// Handles the standard customer export (id_compte_rcu, societe, …, adresse,
// code_postal, ville, departement, filiale, point_de_vente,
// taux_affiliation_pdv) plus an OPTIONAL revenue column (ca / chiffre
// d'affaires) which is picked up automatically when present.

export const STATUTS = {
  ACTIF: { key: 'ACTIF', label: 'Actif', color: '#22c55e' },
  PERDU_2024: { key: 'PERDU_2024', label: 'Perdu 2024', color: '#f59e0b' },
  PERDU_2025: { key: 'PERDU_2025', label: 'Perdu 2025', color: '#ef4444' },
};
export const STATUT_LIST = Object.values(STATUTS);

export function statutColor(statut) {
  return STATUTS[statut]?.color || '#64748b';
}
export function statutLabel(statut) {
  return STATUTS[statut]?.label || statut || 'Inconnu';
}

// ── Column mapping ────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const FIELD_ALIASES = {
  idCompte: ['idcomptercu', 'idclientrcu', 'idcompte', 'idclient'],
  societe: ['societe', 'raisonsociale', 'client', 'nom'],
  nom: ['nom', 'nomcontact', 'nomclient'],
  prenom: ['prenom', 'prenomcontact'],
  telephone: ['telephone', 'tel', 'tel1', 'telephone1', 'mobile', 'portable'],
  email: ['email', 'email1', 'mail', 'courriel'],
  siret: ['siret'],
  identiteJuridique: ['identitejuridique'],
  naf: ['naflibelle', 'naf', 'activite', 'libellenaf'],
  effectifs: ['effectifslibelle', 'effectifs'],
  adresse: ['adresse', 'adresse1', 'rue'],
  codePostal: ['codepostal', 'cp', 'zip'],
  ville: ['ville', 'commune', 'localite'],
  departement: ['departement', 'dept', 'dpt'],
  filiale: ['filiale'],
  pointDeVente: ['pointdevente', 'pdv'],
  tauxAffiliation: ['tauxaffiliationpdv', 'tauxaffiliation', 'taux'],
  // CA-by-year export (cible … ca_magasin_par_annee …)
  ca2024: ['camagasin2024', 'ca2024', 'chiffreaffaires2024'],
  ca2025: ['camagasin2025', 'ca2025', 'chiffreaffaires2025'],
  ca2026: ['camagasin2026', 'ca2026', 'chiffreaffaires2026'],
  caTotal: ['camagasintotal3ans', 'catotal', 'catotal3ans', 'chiffreaffairestotal'],
  nbPassages: ['nbpassagesmagasin3ans', 'nbpassages', 'nbvisites'],
  dernierAchat: ['datedernierachatmagasin', 'datedernierachat', 'dernierachat'],
};

// Excel serial date → ISO yyyy-mm-dd (serial 25569 = 1970-01-01).
export function excelDateToIso(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim();
  // Already a date-ish string
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 1000 || n > 200000) return '';
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Build { field -> columnIndex } from a header row.
export function mapColumns(headerRow) {
  const cols = {};
  const normalized = (headerRow || []).map(norm);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    // Resolve by alias priority (not column order) so e.g. "raison_sociale"
    // wins over a plain "nom" column when both are present.
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) { cols[field] = idx; break; }
    }
  }
  return cols;
}

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Parse an Excel/CSV customer export into raw client rows (not yet geocoded).
export async function parseClientFile(file, statut, onLog) {
  const log = (m, t) => onLog && onLog(m, t);
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('Librairie XLSX non chargée');
  log(`📂 ${file.name}`);
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  if (!rows.length) throw new Error('Fichier vide');

  const cols = mapColumns(rows[0]);
  if (cols.societe === undefined) throw new Error('Colonne société / raison sociale introuvable dans l\'en-tête');
  if (cols.ville === undefined && cols.codePostal === undefined) {
    throw new Error('Aucune colonne de localisation (ville / code postal) trouvée');
  }
  const hasCA = cols.ca2024 !== undefined || cols.ca2025 !== undefined || cols.ca2026 !== undefined || cols.caTotal !== undefined;
  log(`${rows.length - 1} lignes · format ${hasCA ? 'CA par année' : 'portefeuille (statut)'}`, 'ok');
  if (hasCA) log('💶 Colonnes CA détectées (2024/2025/2026)', 'ok');

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.length) continue;
    const get = (f) => (cols[f] !== undefined ? r[cols[f]] : '');
    const societe = String(get('societe') || '').trim();
    if (!societe) continue;
    const cp = String(get('codePostal') || '').trim().replace(/\.0$/, '').padStart(5, '0');
    const ca2024 = toNum(get('ca2024'));
    const ca2025 = toNum(get('ca2025'));
    const ca2026 = toNum(get('ca2026'));
    let caTotal = toNum(get('caTotal'));
    if (caTotal === null && hasCA) {
      const parts = [ca2024, ca2025, ca2026].filter(Number.isFinite);
      caTotal = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
    }
    out.push({
      // A CA export carries no churn status — never infer one for it.
      statut: hasCA ? '' : (statut || ''),
      idCompte: String(get('idCompte') || '').trim(),
      societe,
      nom: String(get('nom') || '').trim(),
      prenom: String(get('prenom') || '').trim(),
      telephone: String(get('telephone') || '').trim(),
      email: String(get('email') || '').trim(),
      siret: String(get('siret') || '').trim(),
      identiteJuridique: String(get('identiteJuridique') || '').trim(),
      naf: String(get('naf') || '').trim(),
      effectifs: String(get('effectifs') || '').trim(),
      adresse: String(get('adresse') || '').trim(),
      codePostal: cp,
      ville: String(get('ville') || '').trim(),
      // The CA export has no "departement" column → derive it from the postcode.
      departement: String(get('departement') || '').trim() || cp.slice(0, 2),
      filiale: String(get('filiale') || '').trim(),
      pointDeVente: String(get('pointDeVente') || '').trim(),
      tauxAffiliation: toNum(get('tauxAffiliation')),
      ca2024, ca2025, ca2026, caTotal,
      nbPassages: toNum(get('nbPassages')),
      dernierAchat: excelDateToIso(get('dernierAchat')),
    });
  }
  log(`✅ ${out.length} lignes lues`, 'ok');

  // The CA export has ONE ROW PER INTERLOCUTEUR, with the exploitation's
  // revenue repeated identically on each row. Collapse them to one record per
  // exploitation, otherwise the same CA is counted several times.
  if (hasCA) {
    const merged = dedupeExploitations(out);
    if (merged.length !== out.length) {
      log(`🏢 ${merged.length} exploitations (${out.length} interlocuteurs regroupés)`, 'ok');
    }
    return merged;
  }
  return out;
}

// Group rows belonging to the same exploitation. Rows of one account share the
// same name, location AND the same CA figures — that signature is the key.
export function dedupeExploitations(rows) {
  const groups = new Map();
  rows.forEach(r => {
    const key = [norm(r.societe), r.codePostal, norm(r.ville), r.ca2024, r.ca2025, r.ca2026].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.values()].map(g => {
    const base = g[0];
    const first = (f) => g.find(r => r[f])?.[f] || '';
    const contacts = [...new Set(
      g.map(r => [r.prenom, r.nom].filter(Boolean).join(' ').trim()).filter(Boolean)
    )];
    const dates = g.map(r => r.dernierAchat).filter(Boolean).sort();
    return {
      ...base,
      nom: base.nom, prenom: base.prenom,
      telephone: first('telephone'),
      email: first('email'),
      nbInterlocuteurs: g.length,
      contacts: contacts.join(', ').slice(0, 900),
      nbPassages: Math.max(...g.map(r => (Number.isFinite(r.nbPassages) ? r.nbPassages : 0))) || base.nbPassages,
      dernierAchat: dates.length ? dates[dates.length - 1] : base.dernierAchat,
    };
  });
}

// ── Bulk geocoding via the French national address base (BAN) ─────────────
// One POST per batch of rows (no API key, CORS-enabled). Far faster and
// friendlier than one request per address.
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function geocodeClients(clients, onLog, batchSize = 400) {
  const log = (m, t) => onLog && onLog(m, t);
  const out = [];
  for (let start = 0; start < clients.length; start += batchSize) {
    const batch = clients.slice(start, start + batchSize);
    const header = 'idx,adresse,codePostal,ville\n';
    const body = batch.map((c, i) =>
      [start + i, csvEscape(c.adresse), csvEscape(c.codePostal), csvEscape(c.ville)].join(',')
    ).join('\n');
    const csv = header + body;

    const fd = new FormData();
    fd.append('data', new Blob([csv], { type: 'text/csv' }), 'data.csv');
    fd.append('columns', 'adresse');
    fd.append('columns', 'ville');
    fd.append('postcode', 'codePostal');

    log(`📍 Géocodage ${start + 1}–${start + batch.length}…`);
    let text = '';
    try {
      const r = await fetch('https://api-adresse.data.gouv.fr/search/csv/', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      text = await r.text();
    } catch (e) {
      log(`⚠️ Géocodage échoué sur ce lot (${e.message}) — repli sur le centre de la commune`, 'warn');
      out.push(...batch.map(c => ({ ...c, lat: null, lng: null, geoScore: 0 })));
      continue;
    }
    const parsed = parseGeocodedCsv(text);
    batch.forEach((c, i) => {
      const g = parsed[String(start + i)];
      out.push({ ...c, lat: g?.lat ?? null, lng: g?.lng ?? null, geoScore: g?.score ?? 0 });
    });
  }
  const ok = out.filter(c => c.lat != null).length;
  log(`✅ ${ok}/${out.length} adresses géolocalisées`, ok === out.length ? 'ok' : 'warn');
  return out;
}

// Minimal CSV parser for the BAN response (quoted fields supported).
function parseGeocodedCsv(text) {
  const rows = splitCsv(text);
  if (!rows.length) return {};
  const head = rows[0];
  const iIdx = head.indexOf('idx');
  const iLat = head.indexOf('latitude');
  const iLng = head.indexOf('longitude');
  const iScore = head.indexOf('result_score');
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const lat = parseFloat(r[iLat]);
    const lng = parseFloat(r[iLng]);
    map[r[iIdx]] = {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      score: parseFloat(r[iScore]) || 0,
    };
  }
  return map;
}

function splitCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── Colour scales ─────────────────────────────────────────────────────────
export const COLOR_MODES = [
  { key: 'ca2024', label: 'CA 2024', kind: 'num' },
  { key: 'ca2025', label: 'CA 2025', kind: 'num' },
  { key: 'ca2026', label: 'CA 2026', kind: 'num' },
  { key: 'caTotal', label: 'CA total 3 ans', kind: 'num' },
  { key: 'evolution', label: 'Évolution CA (24→26)', kind: 'evo' },
  { key: 'nbPassages', label: 'Nb de passages', kind: 'num' },
  { key: 'recence', label: 'Récence du dernier achat', kind: 'recence' },
  { key: 'statut', label: 'Statut (actif / perdu)', kind: 'cat' },
  { key: 'taux', label: "Taux d'affiliation PDV", kind: 'num' },
  { key: 'filiale', label: 'Filiale', kind: 'cat' },
  { key: 'naf', label: 'Activité (NAF)', kind: 'cat' },
];

// CA growth between the first and last year available, as a ratio (-1 … +∞).
export function caEvolution(c) {
  const a = Number.isFinite(c.ca2024) ? c.ca2024 : null;
  const b = Number.isFinite(c.ca2026) ? c.ca2026 : (Number.isFinite(c.ca2025) ? c.ca2025 : null);
  if (a === null || b === null || a <= 0) return null;
  return (b - a) / a;
}

// Red (strong drop) → grey (stable) → green (strong growth), clamped at ±50 %.
export function evolutionColor(ev) {
  if (ev === null || !Number.isFinite(ev)) return '#64748b';
  const r = Math.max(-0.5, Math.min(0.5, ev));
  return gradientColor((r + 0.5) / 1);
}

// Days since the last purchase (null when unknown).
export function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

const CAT_PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#059669', '#4f46e5', '#b91c1c', '#0ea5e9'];

// Build a stable category -> colour map for a list of values.
export function categoryColors(values) {
  const uniq = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const m = new Map();
  uniq.forEach((v, i) => m.set(v, CAT_PALETTE[i % CAT_PALETTE.length]));
  return m;
}

// Green→amber→red gradient for a 0..1 ratio (higher = greener).
export function gradientColor(ratio) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const stops = [
    { p: 0, c: [239, 68, 68] },
    { p: 0.5, c: [245, 158, 11] },
    { p: 1, c: [34, 197, 94] },
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (r >= stops[i].p && r <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = b.p === a.p ? 0 : (r - a.p) / (b.p - a.p);
  const ch = (i) => Math.round(a.c[i] + (b.c[i] - a.c[i]) * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

// Resolve a point's colour for the active mode.
// `ctx.maxByMode` holds the 95th-percentile max for numeric modes so a few
// very large customers don't flatten the whole scale.
export function pointColor(c, mode, ctx) {
  if (mode === 'statut') return statutColor(c.statut);
  if (mode === 'filiale') return ctx.filialeColors?.get(c.filiale) || '#64748b';
  if (mode === 'naf') return ctx.nafColors?.get(c.naf) || '#64748b';
  if (mode === 'evolution') return evolutionColor(caEvolution(c));
  if (mode === 'recence') {
    const d = daysSince(c.dernierAchat);
    if (d === null) return '#64748b';
    // 0 day = green, 365+ days = red
    return gradientColor(1 - Math.min(1, d / 365));
  }
  if (mode === 'taux') {
    if (!Number.isFinite(c.tauxAffiliation)) return '#64748b';
    return gradientColor(c.tauxAffiliation / 100);
  }
  const ratio = scaleRatio(c[mode], ctx.maxByMode?.[mode]);
  return ratio === null ? '#64748b' : gradientColor(ratio);
}

// Robust max (95th percentile) for a numeric field.
export function percentileMax(values, p = 0.95) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return 0;
  return v[Math.min(v.length - 1, Math.floor(v.length * p))] || v[v.length - 1];
}

// Revenue is heavily skewed (median ≈ 450 €, p95 ≈ 7 500 €): on a linear scale
// ~70 % of customers collapse into the bottom colour. A log scale spreads them
// out. The max is shared across the CA years so switching year actually shows
// the rise or fall instead of re-normalising each year independently.
export function scaleRatio(v, max) {
  if (!Number.isFinite(v) || !max || max <= 0) return null;
  return Math.min(1, Math.log1p(Math.max(0, v)) / Math.log1p(max));
}

// Marker radius scaled by CA (so big customers stand out), 4–14 px.
export function pointRadius(c, mode, ctx) {
  const numeric = ['ca2024', 'ca2025', 'ca2026', 'caTotal', 'nbPassages'].includes(mode);
  const key = numeric ? mode : 'caTotal';
  const ratio = scaleRatio(c[key], ctx.maxByMode?.[key]);
  return ratio === null ? 5 : 4 + ratio * 10;
}

export const fmtEuro = (n) =>
  Number.isFinite(n) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';

// ── Aggregates (used for the stats panel and the AI analysis) ─────────────
const r0 = (n) => (Number.isFinite(n) ? Math.round(n) : null);

export function buildStats(clients) {
  const byStatut = {};
  const byDept = {};
  const byFiliale = {};
  const byNaf = {};
  const byPdv = {};
  let tauxSum = 0, tauxN = 0;
  const ca = { 2024: 0, 2025: 0, 2026: 0 };
  const caN = { 2024: 0, 2025: 0, 2026: 0 };
  let passSum = 0, passN = 0;
  let croissance = 0, declin = 0, stable = 0;

  clients.forEach(c => {
    if (c.statut) byStatut[c.statut] = (byStatut[c.statut] || 0) + 1;
    const dept = c.departement || '';
    if (dept) {
      const d = (byDept[dept] ||= { total: 0, ACTIF: 0, PERDU_2024: 0, PERDU_2025: 0, ca2024: 0, ca2025: 0, ca2026: 0 });
      d.total++; if (d[c.statut] !== undefined) d[c.statut]++;
      if (Number.isFinite(c.ca2024)) d.ca2024 += c.ca2024;
      if (Number.isFinite(c.ca2025)) d.ca2025 += c.ca2025;
      if (Number.isFinite(c.ca2026)) d.ca2026 += c.ca2026;
    }
    if (c.filiale) byFiliale[c.filiale] = (byFiliale[c.filiale] || 0) + 1;
    if (c.naf) byNaf[c.naf] = (byNaf[c.naf] || 0) + 1;
    if (c.pointDeVente) {
      const p = (byPdv[c.pointDeVente] ||= { total: 0, ACTIF: 0, PERDU_2024: 0, PERDU_2025: 0, tauxSum: 0, tauxN: 0 });
      p.total++; if (p[c.statut] !== undefined) p[c.statut]++;
      if (Number.isFinite(c.tauxAffiliation)) { p.tauxSum += c.tauxAffiliation; p.tauxN++; }
    }
    if (Number.isFinite(c.tauxAffiliation)) { tauxSum += c.tauxAffiliation; tauxN++; }
    [2024, 2025, 2026].forEach(y => {
      const v = c['ca' + y];
      if (Number.isFinite(v)) { ca[y] += v; caN[y]++; }
    });
    if (Number.isFinite(c.nbPassages)) { passSum += c.nbPassages; passN++; }
    const ev = caEvolution(c);
    if (ev !== null) { if (ev > 0.05) croissance++; else if (ev < -0.05) declin++; else stable++; }
  });

  const total = clients.length;
  const perdus = (byStatut.PERDU_2024 || 0) + (byStatut.PERDU_2025 || 0);
  const evoGlobale = ca[2024] > 0 ? +(((ca[2026] - ca[2024]) / ca[2024]) * 100).toFixed(1) : null;

  return {
    total,
    byStatut,
    perdus,
    tauxMoyen: tauxN ? +(tauxSum / tauxN).toFixed(1) : null,
    caParAnnee: { 2024: r0(ca[2024]), 2025: r0(ca[2025]), 2026: r0(ca[2026]) },
    clientsAvecCA: { 2024: caN[2024], 2025: caN[2025], 2026: caN[2026] },
    caMoyenParClient: caN[2026] ? r0(ca[2026] / caN[2026]) : null,
    evolutionCAGlobalePct: evoGlobale,
    repartitionEvolution: { croissance, stable, declin },
    passagesMoyen: passN ? +(passSum / passN).toFixed(1) : null,
    topDepts: Object.entries(byDept).sort((a, b) => (b[1].ca2026 + b[1].ca2025) - (a[1].ca2026 + a[1].ca2025)).slice(0, 12)
      .map(([code, v]) => ({
        code, clients: v.total,
        ca2024: r0(v.ca2024), ca2025: r0(v.ca2025), ca2026: r0(v.ca2026),
        evolutionPct: v.ca2024 > 0 ? +(((v.ca2026 - v.ca2024) / v.ca2024) * 100).toFixed(1) : null,
        perdus: v.PERDU_2024 + v.PERDU_2025,
      })),
    // Named clients — this stays inside the (authenticated) app and is sent to
    // the analysis so recommendations can target real accounts.
    topClients: [...clients]
      .filter(c => Number.isFinite(c.caTotal))
      .sort((a, b) => b.caTotal - a.caTotal).slice(0, 15)
      .map(c => ({
        societe: c.societe, ville: c.ville,
        ca2024: r0(c.ca2024), ca2026: r0(c.ca2026),
        evolutionPct: Number.isFinite(c.ca2024) && c.ca2024 > 0 && Number.isFinite(c.ca2026)
          ? +(((c.ca2026 - c.ca2024) / c.ca2024) * 100).toFixed(0) : null,
      })),
    plusFortesBaisses: [...clients]
      .filter(c => Number.isFinite(c.ca2024) && Number.isFinite(c.ca2026) && c.ca2026 < c.ca2024)
      .sort((a, b) => (a.ca2026 - a.ca2024) - (b.ca2026 - b.ca2024)).slice(0, 15)
      .map(c => ({
        societe: c.societe, ville: c.ville,
        ca2024: r0(c.ca2024), ca2026: r0(c.ca2026),
        perteEuros: r0(c.ca2024 - c.ca2026),
        dernierAchat: c.dernierAchat || null,
      })),
    topFiliales: Object.entries(byFiliale).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topNaf: Object.entries(byNaf).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topPdv: Object.entries(byPdv).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
      .map(([name, v]) => ({
        name, total: v.total, actifs: v.ACTIF, perdus: v.PERDU_2024 + v.PERDU_2025,
        tauxMoyen: v.tauxN ? +(v.tauxSum / v.tauxN).toFixed(1) : null,
      })),
  };
}
