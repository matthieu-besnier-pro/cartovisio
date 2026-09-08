import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MapPin, Pencil, Table2, Download, Settings2, Save, Share2, Eye,
  Plus, Minus, Search, X, ChevronLeft, Undo2, Redo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  PALETTE, TILES, fetchDeptGeo, fetchDeptBoundary, fetchCantons, ensureOverlayColors, syncCV,
  processExcelFile, processHtmlFile, processJsonFile, processKmlFile, processKmzFile, processGpxFile,
  serializeOverlays, serializeMapView, serializeMarkers, parseOverlays, parseMapView, parseDepartments, parseMarkers, categoryColor,
} from '@/lib/commercialMapUtils';
import LegendSidebar from './LegendSidebar';
import ImportPanel from './ImportPanel';
import DataTableDrawer from './DataTableDrawer';
import SettingsDrawer from './SettingsDrawer';
import ExportModal from './ExportModal';
import LayerPanel from './LayerPanel';
import ChatbotPanel from './ChatbotPanel';

const DEFAULT_STYLE = { fillOpacity: 0.65, dimOpacity: 0.06, borderWeight: 0.6, borderColor: '#ffffff', borderOpacity: 0.85, bordersOn: true };

export default function CommercialMapEditor({ record, readOnly = false, onSave }) {
  const { toast } = useToast();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const geoDataRef = useRef({});
  const deptLoadedRef = useRef(new Set());
  const deptGeoDataRef = useRef({});
  const deptGeoLoadedRef = useRef(new Set());
  const cantonGeoDataRef = useRef({});
  const cantonGeoLoadedRef = useRef(new Set());
  const cantonLayerRef = useRef(null);
  const ancCantonLayerRef = useRef(null);
  const allLRef = useRef({});
  const deptLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markersRef = useRef([]);

  // Refs for layer click handlers (avoid stale closures)
  const editModeRef = useRef(false);
  const editVendorRef = useRef('');
  const editActionRef = useRef('add');
  const overlaysRef = useRef([]);
  const styleRef = useRef(DEFAULT_STYLE);
  const activeVRef = useRef(null);
  const readOnlyRef = useRef(readOnly);

  const [overlays, setOverlaysRaw] = useState([]);
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // History-aware setter: snapshots current overlays before each user edit.
  const setOverlaysHist = useCallback((updater) => {
    const prev = overlaysRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    historyRef.current.push(prev);
    if (historyRef.current.length > 60) historyRef.current.shift();
    futureRef.current = [];
    overlaysRef.current = next;
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(false);
    setOverlaysRaw(next);
  }, []);
  const [activeV, setActiveV] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editVendor, setEditVendor] = useState('');
  const [editAction, setEditAction] = useState('add');
  const [newVendorName, setNewVendorName] = useState('');
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [tile, setTile] = useState('osm');
  const [tableOpen, setTableOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importLog, setImportLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('legend');
  const [layers, setLayers] = useState({ cantons: false, ancCantons: false, departements: false, contours: true, poleAgri: true });
  const [markers, setMarkers] = useState([]);
  const [globalPoints, setGlobalPoints] = useState([]);
  const globalPointsRef = useRef([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const newVendorNameRef = useRef('');

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { editVendorRef.current = editVendor; }, [editVendor]);
  useEffect(() => { editActionRef.current = editAction; }, [editAction]);
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);
  useEffect(() => { styleRef.current = style; }, [style]);
  useEffect(() => { activeVRef.current = activeV; }, [activeV]);
  useEffect(() => { readOnlyRef.current = readOnly; }, [readOnly]);
  useEffect(() => { newVendorNameRef.current = newVendorName; }, [newVendorName]);
  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { globalPointsRef.current = globalPoints; }, [globalPoints]);

  const getLayerStyle = useCallback((vendeur, overlayOpacity, state = 'normal') => {
    const s = styleRef.current;
    const { vColors } = syncCV(overlaysRef.current);
    const c = vColors[vendeur] || '#888';
    const fo = overlayOpacity ?? s.fillOpacity;
    const stroke = s.bordersOn ? s.borderColor : c;
    const w = s.bordersOn ? s.borderWeight : 0;
    const op = s.bordersOn ? s.borderOpacity : 0;
    if (state === 'hover') return { fillColor: c, fillOpacity: Math.min(fo + 0.15, 1), color: stroke, weight: s.bordersOn ? w * 2 : 0, opacity: op };
    if (state === 'dim') return { fillColor: c, fillOpacity: s.dimOpacity, color: '#666', weight: 0.1, opacity: 0.4 };
    return { fillColor: c, fillOpacity: fo, color: stroke, weight: w, opacity: op };
  }, []);

  // Render all layers from overlays
  const renderAll = useCallback(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!map || !L) return 0;
    // Clear existing
    Object.values(allLRef.current).forEach(({ layer }) => { try { map.removeLayer(layer); } catch (e) {} });
    allLRef.current = {};

    let n = 0;
    const ovs = overlaysRef.current;
    ovs.forEach(o => {
      if (!o.visible) return;
      ensureOverlayColors(o);
      Object.entries(o.cV || {}).forEach(([code, vendeur]) => {
        const f = geoDataRef.current[code];
        if (!f) return;
        const layer = L.geoJSON(f, { style: () => getLayerStyle(vendeur, o.opacity) });
        const nom = f.properties?.nom || code;
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (editModeRef.current) {
            handleEditClick(code, nom, vendeur);
          } else {
            map.closePopup();
            const actions = readOnlyRef.current
              ? `<div class="text-[11px] text-slate-500 mt-1">INSEE: ${code}</div>`
              : `<div class="popup-actions" style="display:flex;gap:4px;margin-top:6px">
                   <button class="popup-btn popup-btn-move" data-action="reassign" data-code="${code}" data-nom="${escapeAttr(nom)}" style="flex:1;padding:5px 8px;border:none;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;background:rgba(139,92,246,.12);color:#a78bfa">↔ Réassigner</button>
                   <button class="popup-btn popup-btn-del" data-action="remove" data-code="${code}" data-nom="${escapeAttr(nom)}" data-vendeur="${escapeAttr(vendeur)}" style="flex:1;padding:5px 8px;border:none;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;background:rgba(239,68,68,.1);color:#f87171">🗑 Retirer</button>
                 </div>`;
            L.popup({ className: 'cmap-popup' }).setLatLng(layer.getBounds().getCenter()).setContent(
              `<div style="font-family:Inter,system-ui,sans-serif;min-width:160px">
                 <div style="font-weight:700;font-size:13px;color:#0f172a">${escapeHtml(nom)}</div>
                 <div style="display:flex;align-items:center;gap:6px;margin-top:4px"><span style="width:10px;height:10px;border-radius:50%;background:${syncCV(overlaysRef.current).vColors[vendeur] || '#888'}"></span><span style="font-weight:600;font-size:12px;color:#334155">${escapeHtml(vendeur)}</span></div>
                 ${actions}
               </div>`
            ).openOn(map);
          }
        });
        layer.on('mouseover', () => { if (!activeVRef.current || activeVRef.current === vendeur) layer.setStyle(getLayerStyle(vendeur, o.opacity, 'hover')); });
        layer.on('mouseout', () => {
          if (activeVRef.current && activeVRef.current !== vendeur) layer.setStyle(getLayerStyle(vendeur, o.opacity, 'dim'));
          else layer.setStyle(getLayerStyle(vendeur, o.opacity));
        });
        layer.addTo(map);
        allLRef.current[code] = { layer, vendeur };
        n++;
      });
    });
    // Apply activeV dimming
    if (activeVRef.current) applyActiveV(activeVRef.current);
    return n;
  }, [getLayerStyle]);

  const undo = useCallback(() => {
    if (!historyRef.current.length) return;
    const past = historyRef.current.pop();
    futureRef.current.push(overlaysRef.current);
    overlaysRef.current = past;
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    setOverlaysRaw(past);
    setTimeout(renderAll, 0);
  }, [renderAll]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current.pop();
    historyRef.current.push(overlaysRef.current);
    overlaysRef.current = next;
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
    setOverlaysRaw(next);
    setTimeout(renderAll, 0);
  }, [renderAll]);

  useEffect(() => {
    const onKey = (e) => {
      if (readOnlyRef.current) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const applyActiveV = useCallback((name) => {
    Object.entries(allLRef.current).forEach(([code, { layer, vendeur }]) => {
      const o = overlaysRef.current.find(o => o.visible && o.cV?.[code]);
      if (!o) return;
      if (vendeur === name) layer.setStyle(getLayerStyle(vendeur, o.opacity));
      else layer.setStyle(getLayerStyle(vendeur, o.opacity, 'dim'));
    });
  }, [getLayerStyle]);

  const renderMarkers = useCallback(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!map || !L) return;
    if (!markersLayerRef.current) markersLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current.clearLayers();
    if (!layers.poleAgri) return;
    [...markersRef.current, ...globalPointsRef.current].forEach(mk => {
      const c = categoryColor(mk.category);
      const icon = L.divIcon({
        className: 'pa-marker',
        html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${c},${c}cc);border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1">🌾</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${c}"></div></div>`,
        iconSize: [28, 35],
        iconAnchor: [14, 35],
        popupAnchor: [0, -33],
      });
      const marker = L.marker([mk.lat, mk.lng], { icon });
      const sub = mk.category
        ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px"><span style="width:10px;height:10px;border-radius:50%;background:${c}"></span><span style="font-weight:600;font-size:11px;color:${c}">${escapeHtml(mk.category)}</span></div>`
        : `<div style="display:flex;align-items:center;gap:6px;margin-top:4px"><span style="font-size:12px">🌾</span><span style="font-weight:600;font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:.5px">Pôle Agri</span></div>`;
      marker.bindPopup(`<div style="font-family:Inter,system-ui,sans-serif;min-width:140px"><div style="font-weight:700;font-size:13px;color:#0f172a">${escapeHtml(mk.name || 'Pôle Agri')}</div>${sub}</div>`, { className: 'cmap-popup' });
      markersLayerRef.current.addLayer(marker);
    });
  }, [layers.poleAgri]);

  const handleEditClick = useCallback((code, nom, currentVendeur) => {
    const action = editActionRef.current;
    if (action === 'remove') {
      setOverlaysHist(prev => {
        const next = prev.map(o => { const cV = { ...o.cV }; delete cV[code]; return { ...o, cV }; });
        overlaysRef.current = next;
        setTimeout(renderAll, 0);
        return next;
      });
      toast({ title: `"${nom}" retirée` });
    } else {
      const sel = editVendorRef.current;
      let vendeur = sel === '__new__' ? newVendorNameRef.current.trim() : sel;
      if (!vendeur) { toast({ title: 'Choisissez un commercial', variant: 'destructive' }); return; }
      if (currentVendeur === vendeur) { toast({ title: `Déjà assignée à ${vendeur}` }); return; }
      setOverlaysHist(prev => {
        let next = [...prev];
        if (!next.length) next.push({ id: Date.now(), name: 'Secteurs', cV: {}, vColors: {}, opacity: styleRef.current.fillOpacity, visible: true });
        next = next.map((o, i) => {
          if (i !== next.length - 1) { const cV = { ...o.cV }; delete cV[code]; return { ...o, cV }; }
          const cV = { ...o.cV, [code]: vendeur };
          return { ...o, cV };
        });
        ensureOverlayColors(next[next.length - 1]);
        overlaysRef.current = next;
        setTimeout(renderAll, 0);
        return next;
      });
      toast({ title: currentVendeur ? `"${nom}" : ${currentVendeur} → ${vendeur}` : `"${nom}" → ${vendeur}` });
    }
  }, [renderAll, toast]);

  // Popup action delegation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onContainerClick = (ev) => {
      const btn = ev.target.closest?.('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const code = btn.dataset.code;
      const nom = btn.dataset.nom;
      map.closePopup();
      if (action === 'remove') {
        setOverlaysHist(prev => {
          const next = prev.map(o => { const cV = { ...o.cV }; delete cV[code]; return { ...o, cV }; });
          overlaysRef.current = next;
          setTimeout(renderAll, 0);
          return next;
        });
        toast({ title: `"${nom}" retirée` });
      } else if (action === 'reassign') {
        setEditMode(true);
        setEditAction('add');
        toast({ title: 'Mode édition activé — choisissez un commercial puis cliquez' });
      }
    };
    map.getContainer().addEventListener('click', onContainerClick);
    return () => map.getContainer().removeEventListener('click', onContainerClick);
  }, [renderAll, toast]);

  // Blank-map click in edit mode → find commune by point-in-polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e) => {
      if (!editModeRef.current) return;
      const { lat, lng } = e.latlng;
      let found = null;
      for (const [code, f] of Object.entries(geoDataRef.current)) {
        if (ptInFeature(lat, lng, f)) { found = code; break; }
      }
      if (!found) { toast({ title: 'Commune non trouvée (dépt non chargé)', variant: 'destructive' }); return; }
      const nom = geoDataRef.current[found].properties?.nom || found;
      const currentV = syncCV(overlaysRef.current).cV[found] || null;
      handleEditClick(found, nom, currentV);
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [handleEditClick, toast]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;
    const mv = parseMapView(record?.mapView);
    const map = L.map(containerRef.current, {
      center: mv ? [mv.lat, mv.lng] : [46.8, -0.5],
      zoom: mv?.zoom || 8,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    mapRef.current = map;
    map.createPane('deptPane');
    map.getPane('deptPane').style.zIndex = 440;
    map.getPane('deptPane').style.pointerEvents = 'none';
    deptLayerRef.current = L.layerGroup([], { pane: 'deptPane' }).addTo(map);
    map.createPane('cantonPane');
    map.getPane('cantonPane').style.zIndex = 430;
    map.getPane('cantonPane').style.pointerEvents = 'none';
    cantonLayerRef.current = L.layerGroup([], { pane: 'cantonPane' }).addTo(map);
    ancCantonLayerRef.current = L.layerGroup([], { pane: 'cantonPane' }).addTo(map);

    const t = TILES[tile] || TILES['osm'];
    tileLayerRef.current = L.tileLayer(t.url, t.opts).addTo(map);

    // Load initial overlays + departments
    const init = async () => {
      const ovs = parseOverlays(record?.overlays);
      ovs.forEach(o => ensureOverlayColors(o));
      overlaysRef.current = ovs;
      setOverlaysRaw(ovs);
      const mks = parseMarkers(record?.markers);
      markersRef.current = mks;
      setMarkers(mks);
      const depts = parseDepartments(record?.departments);
      if (depts.length) {
        setLoading(true);
        for (const d of depts) await fetchDeptGeo(d, geoDataRef.current, deptLoadedRef.current);
        setLoading(false);
      }
      renderAll();
      renderMarkers();
      // Load global Pôle Agri points (shared layer across all maps)
      base44.entities.PoleAgriPoint.list('-updated_date', 5000).then(pts => {
        globalPointsRef.current = pts || [];
        setGlobalPoints(pts || []);
        renderMarkers();
      }).catch(() => {});
      // Fit to data if no saved view
      if (!mv && Object.keys(syncCV(ovs).cV).length) {
        try {
          const layers = Object.values(allLRef.current).map(x => x.layer);
          if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [30, 30] });
        } catch (e) {}
      }
    };
    init();

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) { map.removeLayer(tileLayerRef.current); tileLayerRef.current = null; }
    const t = TILES[tile];
    if (t) { tileLayerRef.current = window.L.tileLayer(t.url, t.opts).addTo(map); tileLayerRef.current.bringToBack(); }
  }, [tile]);

  // Re-render layers when overlays or style change
  useEffect(() => { renderAll(); }, [overlays, renderAll]);
  useEffect(() => { renderAll(); }, [style, renderAll]);
  useEffect(() => { renderMarkers(); }, [markers, renderMarkers]);

  // Sync contours toggle with style.bordersOn
  useEffect(() => { setStyle(s => ({ ...s, bordersOn: layers.contours })); }, [layers.contours]);

  // Department contours
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layers.departements) { deptLayerRef.current.clearLayers(); return; }
    const { cV } = syncCV(overlaysRef.current);
    if (!Object.keys(cV).length) { toast({ title: 'Importez des données d\'abord', variant: 'destructive' }); setLayers(l => ({ ...l, departements: false })); return; }
    const depts = [...new Set(Object.keys(cV).map(c => c.slice(0, 2)))];
    (async () => {
      for (const d of depts) await fetchDeptBoundary(d, deptGeoDataRef.current, deptGeoLoadedRef.current);
      deptLayerRef.current.clearLayers();
      depts.forEach(d => {
        const feat = deptGeoDataRef.current[d];
        if (!feat) return;
        window.L.geoJSON(feat, { pane: 'deptPane', style: { fill: false, color: '#f97316', weight: 4, opacity: 0.85, dashArray: '12 6' } })
          .bindTooltip(`<b>${d}</b>`, { sticky: true, direction: 'top' })
          .addTo(deptLayerRef.current);
      });
    })();
  }, [layers.departements, overlays, toast]);

  // Cantons + Anc. cantons (both sourced from canton GeoJSON, distinct styles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const renderCantons = async (layerRef, color, weight, dash) => {
      const { cV } = syncCV(overlaysRef.current);
      const depts = Object.keys(cV).length
        ? [...new Set(Object.keys(cV).map(c => c.slice(0, 2)))]
        : [...deptLoadedRef.current];
      if (!depts.length) { toast({ title: 'Importez ou chargez des données d\'abord', variant: 'destructive' }); setLayers(l => ({ ...l, cantons: false, ancCantons: false })); return; }
      for (const d of depts) await fetchCantons(d, cantonGeoDataRef.current, cantonGeoLoadedRef.current);
      layerRef.current.clearLayers();
      depts.forEach(d => {
        const gj = cantonGeoDataRef.current[d];
        if (!gj || !gj.features) return;
        window.L.geoJSON(gj, { pane: 'cantonPane', style: { fill: false, color, weight, opacity: 0.7, dashArray: dash } })
          .addTo(layerRef.current);
      });
    };
    if (layers.cantons) renderCantons(cantonLayerRef, '#10b981', 2.5, null);
    else cantonLayerRef.current.clearLayers();
    if (layers.ancCantons) renderCantons(ancCantonLayerRef, '#fbbf24', 2, '8 4');
    else ancCantonLayerRef.current.clearLayers();
  }, [layers.cantons, layers.ancCantons, overlays, toast]);

  // Search commune in edit mode
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const res = Object.entries(geoDataRef.current).filter(([code, f]) => {
      const n = (f.properties?.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n.startsWith(q) || code.startsWith(searchQuery);
    }).slice(0, 10).map(([code, f]) => ({ code, nom: f.properties?.nom || code, dept: code.slice(0, 2), assigned: syncCV(overlaysRef.current).cV[code] }));
    setSearchResults(res);
  }, [searchQuery]);

  const handleImport = async (file, codeType) => {
    setLoading(true);
    setImportLog([]);
    try {
      const onLog = (msg, type) => setImportLog(prev => [...prev, { msg, type }]);
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let res;
      if (['html', 'htm', 'xhtml'].includes(ext)) {
        res = await processHtmlFile(file, onLog);
      } else if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
        let f = file;
        if (ext === 'csv' || ext === 'tsv') {
          const txt = await file.text();
          const semi = (txt.match(/;/g) || []).length;
          const comma = (txt.match(/,/g) || []).length;
          if (semi > comma) f = new File([txt.replace(/;/g, ',')], file.name, { type: 'text/csv' });
        }
        res = await processExcelFile(f, codeType, onLog);
      } else if (['json', 'geojson'].includes(ext)) {
        res = await processJsonFile(file, onLog);
      } else if (ext === 'kml') {
        res = await processKmlFile(file, onLog);
      } else if (ext === 'kmz') {
        res = await processKmzFile(file, onLog);
      } else if (ext === 'gpx') {
        res = await processGpxFile(file, onLog);
      } else {
        throw new Error('Format non supporté : .' + ext);
      }
      const { name, cV, departments } = res;
      const newMarkers = res.markers || [];
      if (departments.length) onLog(`Chargement de ${departments.length} département(s)...`, '');
      for (const d of departments) await fetchDeptGeo(d, geoDataRef.current, deptLoadedRef.current);
      if (newMarkers.length) {
        setMarkers(prev => {
          const next = [...prev, ...newMarkers];
          markersRef.current = next;
          setTimeout(renderMarkers, 0);
          return next;
        });
      }
      if (Object.keys(cV).length) {
        const newOverlay = { id: Date.now(), name, cV, vColors: {}, opacity: style.fillOpacity, visible: true };
        ensureOverlayColors(newOverlay);
        setOverlaysHist(prev => {
          const next = [...prev, newOverlay];
          overlaysRef.current = next;
          setTimeout(() => {
            renderAll();
            try {
              const layers = Object.values(allLRef.current).map(x => x.layer);
              if (layers.length) mapRef.current.fitBounds(window.L.featureGroup(layers).getBounds(), { padding: [30, 30] });
            } catch (e) {}
          }, 50);
          return next;
        });
        onLog(`✅ ${Object.keys(cV).length} communes importées`, 'ok');
      } else if (newMarkers.length) {
        setTimeout(() => {
          try {
            const pts = newMarkers.map(mk => [mk.lat, mk.lng]);
            if (pts.length) mapRef.current.fitBounds(window.L.latLngBounds(pts), { padding: [50, 50] });
          } catch (e) {}
        }, 60);
      }
      setSidebarTab('legend');
    } catch (err) {
      setImportLog(prev => [...prev, { msg: `❌ ${err.message}`, type: 'err' }]);
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      const map = mapRef.current;
      const c = map.getCenter();
      const departments = [...deptLoadedRef.current];
      await onSave({
        overlays: serializeOverlays(overlays),
        mapView: serializeMapView(c.lat, c.lng, map.getZoom()),
        departments: JSON.stringify(departments),
        markers: serializeMarkers(markersRef.current),
      });
      toast({ title: 'Carte enregistrée ✓' });
    } catch (e) {
      toast({ title: 'Erreur sauvegarde', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    if (!record?.shareToken) { toast({ title: 'Enregistrez la carte pour obtenir un lien', variant: 'destructive' }); return; }
    const url = `${window.location.origin}/public/${record.shareToken}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: 'Lien public copié ✓' })).catch(() => toast({ title: url }));
  };

  const toggleVendor = (name) => {
    if (activeV === name) { setActiveV(null); activeVRef.current = null; renderAll(); }
    else { setActiveV(name); activeVRef.current = name; applyActiveV(name); fitToVendor(name); }
  };
  const showAll = () => { setActiveV(null); activeVRef.current = null; renderAll(); };
  const fitToVendor = (name) => {
    const layers = Object.entries(allLRef.current).filter(([, v]) => v.vendeur === name).map(([, v]) => v.layer);
    if (layers.length) try { mapRef.current.fitBounds(window.L.featureGroup(layers).getBounds(), { padding: [40, 40] }); } catch (e) {}
  };
  const resetView = () => {
    showAll();
    const layers = Object.values(allLRef.current).map(x => x.layer);
    if (layers.length) try { mapRef.current.fitBounds(window.L.featureGroup(layers).getBounds(), { padding: [30, 30] }); } catch (e) {}
    else mapRef.current.setView([46.8, -0.5], 8);
  };

  const toggleOverlayVisible = (id) => setOverlaysHist(prev => { const next = prev.map(o => o.id === id ? { ...o, visible: !o.visible } : o); overlaysRef.current = next; setTimeout(renderAll, 0); return next; });
  const removeOverlay = (id) => setOverlaysHist(prev => { const next = prev.filter(o => o.id !== id); overlaysRef.current = next; setTimeout(renderAll, 0); return next; });
  const changeOpacity = (id, val) => setOverlaysHist(prev => { const next = prev.map(o => o.id === id ? { ...o, opacity: parseInt(val) / 100 } : o); overlaysRef.current = next; setTimeout(renderAll, 0); return next; });
  const changeColor = (id, vendeur, c) => setOverlaysHist(prev => { const next = prev.map(o => o.id === id ? { ...o, vColors: { ...o.vColors, [vendeur]: c } } : o); overlaysRef.current = next; setTimeout(renderAll, 0); return next; });

  const tableChangeVendeur = (code, vendeur) => {
    if (vendeur === '__new__') {
      const v = window.prompt('Nom du nouveau commercial :', '');
      if (!v || !v.trim()) return;
      vendeur = v.trim();
    }
    setOverlaysHist(prev => {
      let next = [...prev];
      if (!next.length) next.push({ id: Date.now(), name: 'Secteurs', cV: {}, vColors: {}, opacity: style.fillOpacity, visible: true });
      next = next.map((o, i) => {
        if (i !== next.length - 1) { const cV = { ...o.cV }; delete cV[code]; return { ...o, cV }; }
        return { ...o, cV: { ...o.cV, [code]: vendeur } };
      });
      ensureOverlayColors(next[next.length - 1]);
      overlaysRef.current = next;
      setTimeout(renderAll, 0);
      return next;
    });
    toast({ title: `"${geoDataRef.current[code]?.properties?.nom || code}" → ${vendeur}` });
  };
  const tableRemove = (code) => setOverlaysHist(prev => { const next = prev.map(o => { const cV = { ...o.cV }; delete cV[code]; return { ...o, cV }; }); overlaysRef.current = next; setTimeout(renderAll, 0); return next; });

  const clearAll = () => {
    setOverlaysHist(prev => { overlaysRef.current = []; setTimeout(renderAll, 0); return []; });
    setMarkers(prev => { markersRef.current = []; setTimeout(renderMarkers, 0); return []; });
    toast({ title: 'Toutes les données effacées' });
  };

  // Resolve a commune by fuzzy name or code from loaded geo data
  const resolveCommune = (query) => {
    if (!query) return null;
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const code = query.trim().padStart(5, '0');
    if (/^[0-9A-Z]{5}$/.test(code) && geoDataRef.current[code]) return code;
    let best = null, bestScore = Infinity;
    for (const [c, f] of Object.entries(geoDataRef.current)) {
      const n = (f.properties?.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (n === q) return c;
      if (n.startsWith(q) && n.length - q.length < bestScore) { best = c; bestScore = n.length - q.length; }
      else if (n.includes(q) && !best) best = c;
    }
    return best;
  };

  // Apply an action returned by the AI chatbot
  const handleChatAction = (action) => {
    try {
      if (action.action === 'assign') {
        const code = resolveCommune(action.commune);
        if (!code) { toast({ title: `Commune « ${action.commune} » introuvable`, variant: 'destructive' }); return; }
        const vendeur = action.vendor?.trim();
        if (!vendeur) { toast({ title: 'Commercial manquant', variant: 'destructive' }); return; }
        const nom = geoDataRef.current[code].properties?.nom || code;
        setOverlaysHist(prev => {
          let next = [...prev];
          if (!next.length) next.push({ id: Date.now(), name: 'Secteurs', cV: {}, vColors: {}, opacity: styleRef.current.fillOpacity, visible: true });
          next = next.map((o, i) => {
            if (i !== next.length - 1) { const cV = { ...o.cV }; delete cV[code]; return { ...o, cV }; }
            return { ...o, cV: { ...o.cV, [code]: vendeur } };
          });
          ensureOverlayColors(next[next.length - 1]);
          overlaysRef.current = next;
          setTimeout(renderAll, 0);
          return next;
        });
        toast({ title: `"${nom}" → ${vendeur}` });
      } else if (action.action === 'remove') {
        const code = resolveCommune(action.commune);
        if (!code) { toast({ title: `Commune introuvable`, variant: 'destructive' }); return; }
        tableRemove(code);
      } else if (action.action === 'setColor') {
        changeColor(overlays[overlays.length - 1]?.id, action.vendor, action.color);
      } else if (action.action === 'showOnly') {
        toggleVendor(action.vendor);
      } else if (action.action === 'showAll') {
        showAll();
      } else if (action.action === 'rename') {
        const oldName = action.vendor?.trim();
        const newName = action.newName?.trim();
        if (!oldName || !newName) return;
        setOverlaysHist(prev => {
          const next = prev.map(o => {
            const cV = {}; Object.entries(o.cV || {}).forEach(([c, v]) => { cV[c] = v === oldName ? newName : v; });
            const vColors = {}; Object.entries(o.vColors || {}).forEach(([v, col]) => { vColors[v === oldName ? newName : v] = col; });
            return { ...o, cV, vColors };
          });
          overlaysRef.current = next;
          setTimeout(renderAll, 0);
          return next;
        });
        toast({ title: `${oldName} → ${newName}` });
      }
    } catch (e) {
      toast({ title: 'Action échouée', description: e.message, variant: 'destructive' });
    }
  };

  const selectFromSearch = async (code, nom) => {
    setSearchQuery(''); setSearchResults([]);
    const dept = code.slice(0, 2);
    if (!deptLoadedRef.current.has(dept)) {
      setLoading(true); await fetchDeptGeo(dept, geoDataRef.current, deptLoadedRef.current); setLoading(false);
    }
    if (editMode) {
      const currentV = syncCV(overlaysRef.current).cV[code] || null;
      handleEditClick(code, nom, currentV);
      const f = geoDataRef.current[code];
      if (f) try { mapRef.current.fitBounds(window.L.geoJSON(f).getBounds(), { maxZoom: 12, padding: [60, 60] }); } catch (e) {}
    } else {
      const f = geoDataRef.current[code];
      if (f) { try { mapRef.current.fitBounds(window.L.geoJSON(f).getBounds(), { maxZoom: 12, padding: [60, 60] }); } catch (e) {} }
    }
  };

  const vendors = [...new Set(overlays.flatMap(o => Object.values(o.cV || {})))].sort();
  const accent = record?.accentColor || '#f43f5e';
  const chatVendors = vendors.map(name => ({ name, count: overlays.reduce((s, o) => s + Object.values(o.cV || {}).filter(v => v === name).length, 0) }));
  const communeNames = Object.values(geoDataRef.current).map(f => f.properties?.nom).filter(Boolean);

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-slate-200 overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="h-12 px-3 sm:px-4 flex items-center justify-between bg-slate-950/92 backdrop-blur border-b border-slate-800/60 shrink-0 z-[900]">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => window.history.back()} className="text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-extrabold tracking-wide uppercase truncate">
            {record?.title || 'Nouvelle carte'}
          </h1>
          {record && <span className="hidden sm:inline text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Secteurs</span>}
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={resetView} title="Vue globale"><MapPin className="w-4 h-4" /></IconBtn>
          {!readOnly && (
            <>
              <IconBtn onClick={undo} title="Annuler (Ctrl+Z)" disabled={!canUndo}><Undo2 className="w-4 h-4" /></IconBtn>
              <IconBtn onClick={redo} title="Rétablir (Ctrl+Y)" disabled={!canRedo}><Redo2 className="w-4 h-4" /></IconBtn>
            </>
          )}
          {!readOnly && (
            <IconBtn onClick={() => setEditMode(!editMode)} active={editMode} title="Éditer communes"><Pencil className="w-4 h-4" /></IconBtn>
          )}
          <IconBtn onClick={() => setTableOpen(!tableOpen)} active={tableOpen} title="Tableau"><Table2 className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => setShowExport(true)} title="Exporter"><Download className="w-4 h-4" /></IconBtn>
          {!readOnly && (
            <IconBtn onClick={() => setSettingsOpen(!settingsOpen)} active={settingsOpen} title="Style"><Settings2 className="w-4 h-4" /></IconBtn>
          )}
          <div className="w-px h-5 bg-slate-700/50 mx-1.5" />
          {!readOnly && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 gap-1.5 text-xs" style={{ background: `linear-gradient(135deg, ${accent}, #e11d48)` }}>
              <Save className="w-3.5 h-3.5" /> {saving ? '...' : 'Enregistrer'}
            </Button>
          )}
          {record?.shareToken && (
            <Button size="sm" variant="outline" onClick={handleShare} className="h-8 gap-1.5 text-xs ml-1 border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-700/40">
              <Share2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Partager</span>
            </Button>
          )}
        </div>
      </header>

      {/* Layer & data panel */}
      <LayerPanel
        layers={layers}
        onToggleLayer={(key) => setLayers(l => ({ ...l, [key]: !l[key] }))}
        overlays={overlays}
        onManage={() => setTableOpen(true)}
        onClearAll={clearAll}
        readOnly={readOnly}
        markerCount={markers.length + globalPoints.length}
      />

      {/* Main */}
      <div className="flex flex-1 overflow-hidden relative">
        <div ref={containerRef} className={cn('flex-1 z-[1] transition-all', editMode && 'cursor-crosshair')} style={{ background: '#1a1a2e' }} />

        {/* Sidebar */}
        {!readOnly && (
          <aside className={cn('absolute lg:relative top-0 right-0 h-full w-[320px] bg-slate-900/96 backdrop-blur border-l border-slate-800/60 flex flex-col z-[850] transition-transform', sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:border-l-0 overflow-hidden')}>
            <div className="flex border-b border-slate-800/60 bg-slate-950/40 shrink-0">
              <TabBtn active={sidebarTab === 'legend'} onClick={() => setSidebarTab('legend')} icon={<MapPin className="w-3.5 h-3.5" />}>Secteurs</TabBtn>
              <TabBtn active={sidebarTab === 'import'} onClick={() => setSidebarTab('import')} icon={<Download className="w-3.5 h-3.5" />}>Import</TabBtn>
            </div>
            {sidebarTab === 'legend' && <LegendSidebar overlays={overlays} activeV={activeV} onToggleVendor={toggleVendor} onShowAll={showAll} onToggleOverlayVisible={toggleOverlayVisible} onRemoveOverlay={removeOverlay} onChangeOpacity={changeOpacity} onChangeColor={changeColor} readOnly={readOnly} />}
            {sidebarTab === 'import' && <ImportPanel onImport={handleImport} importLog={importLog} loading={loading} />}
          </aside>
        )}
        {readOnly && (
          <aside className="w-[300px] bg-slate-900/96 backdrop-blur border-l border-slate-800/60 flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-slate-800/60 bg-slate-950/40">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Légende</span>
            </div>
            <LegendSidebar overlays={overlays} activeV={activeV} onToggleVendor={toggleVendor} onShowAll={showAll} onToggleOverlayVisible={toggleOverlayVisible} onRemoveOverlay={removeOverlay} onChangeOpacity={changeOpacity} onChangeColor={changeColor} readOnly={readOnly} />
          </aside>
        )}
      </div>

      {/* Mobile sidebar toggle */}
      {!readOnly && (
        <button onClick={() => setSidebarOpen(o => !o)} className="lg:hidden absolute top-[60px] right-2.5 z-[860] bg-slate-900/90 border border-slate-700/60 rounded-lg p-2 text-slate-300">
          {sidebarOpen ? <X className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
        </button>
      )}

      {/* Edit bar */}
      {editMode && !readOnly && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[900] bg-slate-900/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3 flex-wrap shadow-2xl max-w-[92vw]">
          <span className="text-xs font-semibold text-violet-300">✏️ Édition</span>
          <div className="flex gap-1">
            <button onClick={() => setEditAction('add')} className={cn('px-2.5 py-1.5 rounded-lg text-xs font-semibold transition', editAction === 'add' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-slate-800/60 text-slate-400')}><Plus className="w-3 h-3 inline mr-1" />Ajouter</button>
            <button onClick={() => setEditAction('remove')} className={cn('px-2.5 py-1.5 rounded-lg text-xs font-semibold transition', editAction === 'remove' ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40' : 'bg-slate-800/60 text-slate-400')}><Minus className="w-3 h-3 inline mr-1" />Retirer</button>
          </div>
          {editAction === 'add' && (
            <>
              <select value={editVendor} onChange={(e) => setEditVendor(e.target.value)} className="bg-slate-950/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-xs text-slate-200">
                <option value="">— Commercial —</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                <option value="__new__">＋ Nouveau...</option>
              </select>
              {editVendor === '__new__' && (
                <Input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="Nom..." className="h-8 w-32 text-xs bg-slate-950/60 border-slate-700/60" />
              )}
            </>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher commune..." className="bg-slate-950/60 border border-slate-700/60 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-200 w-44" />
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700/60 rounded-lg shadow-2xl max-h-56 overflow-y-auto z-10">
                {searchResults.map(r => (
                  <button key={r.code} onClick={() => selectFromSearch(r.code, r.nom)} className="w-full text-left px-3 py-2 text-xs hover:bg-sky-500/10 border-b border-slate-800/40">
                    <span className="text-slate-200">{r.nom}</span> <span className="text-slate-500">({r.dept})</span> {r.assigned && <span className="text-emerald-400 text-[10px]">✓ {r.assigned}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute bottom-8 right-[330px] z-[500] bg-slate-950/85 backdrop-blur text-slate-400 text-xs px-4 py-2 rounded-lg border border-slate-800/60 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" /> Chargement...
        </div>
      )}

      {readOnly && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[500] text-[10px] text-slate-400/80 bg-slate-950/60 backdrop-blur px-3 py-1 rounded-full border border-slate-800/50 pointer-events-none whitespace-nowrap">
          Pôle Agricole · Groupe Dubreuil
        </div>
      )}

      {/* Drawers & modals */}
      <DataTableDrawer open={tableOpen} overlays={overlays} geoData={geoDataRef.current} onClose={() => setTableOpen(false)} onChangeVendeur={tableChangeVendeur} onRemove={tableRemove} readOnly={readOnly} />
      {!readOnly && <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} style={style} onStyle={setStyle} tile={tile} onTile={setTile} />}
      <ExportModal open={showExport} onClose={() => setShowExport(false)} overlays={overlays} geoData={geoDataRef.current} title={record?.title} accent={accent} />

      {/* AI chatbot */}
      {!readOnly && <ChatbotPanel vendors={chatVendors} communeNames={communeNames} onAction={handleChatAction} />}

      <style>{`
        .cmap-popup .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.15); }
        .leaflet-control-zoom a { background: rgba(15,23,42,.9)!important; color: #94a3b8!important; border-color: rgba(148,163,184,.08)!important; border-radius: 10px!important; }
        .leaflet-control-zoom a:hover { background: rgba(51,65,85,.95)!important; color: #e2e8f0!important; }
        .pa-marker.leaflet-div-icon { background: transparent; border: none; }
      `}</style>
    </div>
  );
}

function IconBtn({ children, onClick, title, active, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} className={cn('w-9 h-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none', active ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-200')}>
      {children}
    </button>
  );
}

function TabBtn({ children, active, onClick, icon }) {
  return (
    <button onClick={onClick} className={cn('flex-1 py-3 px-2 text-xs font-semibold flex flex-col items-center gap-1 border-b-2 transition-colors', active ? 'text-slate-100 border-rose-500 bg-rose-500/5' : 'text-slate-500 border-transparent hover:text-slate-300')}>
      {icon} {children}
    </button>
  );
}

function ptInFeature(lat, lng, feature) {
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) if (ptInRing(lat, lng, poly[0])) return true;
  return false;
}
function ptInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function escapeHtml(s) { return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function escapeAttr(s) { return String(s).replace(/['"<>]/g, c => ({ "'": '&#39;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c])); }