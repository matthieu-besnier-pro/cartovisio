import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ZoomIn, RotateCcw, Move } from 'lucide-react';
import { filialeStyle } from '@/lib/commercialMapUtils';

const STAGE = 300;      // crop stage size (px)
const RADIUS = 128;     // circular crop radius (px)
const OUT = 256;        // output image size (px)

// A delightful circular logo cropper with live marker preview + auto color.
// Props:
//   src            : object URL (new upload) or http URL (re-crop existing)
//   filialeName    : label shown in the header
//   initialColor   : starting accent color
//   onCancel()     : close without saving
//   onSave(blob, color) : returns a cropped PNG Blob + chosen accent color
export default function LogoCropper({ src, filialeName, initialColor, onCancel, onSave }) {
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [img, setImg] = useState(null);
  const [scale, setScale] = useState(1);       // user zoom multiplier (>= 1)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState(initialColor || '#16a34a');
  const [swatches, setSwatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fallbackEmoji = useMemo(() => filialeStyle(filialeName).emoji, [filialeName]);

  // Load the image (crossOrigin so we can read pixels / export even for remote logos)
  useEffect(() => {
    setImg(null); setError(''); setPan({ x: 0, y: 0 }); setScale(1);
    if (!src) return;
    const image = new Image();
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => { setImg(image); extractColors(image); };
    image.onerror = () => setError("Impossible de charger l'image.");
    image.src = src;
    return () => { image.onload = null; image.onerror = null; };
  }, [src]);

  // cover scale: the base scale so the image fully covers the crop circle
  const coverScale = useMemo(() => {
    if (!img) return 1;
    return Math.max((RADIUS * 2) / img.naturalWidth, (RADIUS * 2) / img.naturalHeight);
  }, [img]);

  const dispScale = coverScale * scale;

  // Clamp pan so the circle stays fully covered by the image
  const clampPan = (p, s = dispScale) => {
    if (!img) return p;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const maxX = Math.max(0, (dw - RADIUS * 2) / 2);
    const maxY = Math.max(0, (dh - RADIUS * 2) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  };

  useEffect(() => { setPan(p => clampPan(p)); /* re-clamp on zoom */ // eslint-disable-next-line
  }, [scale, img]);

  // ── Auto color extraction (average of a downscaled sample) ──
  const extractColors = (image) => {
    try {
      const c = document.createElement('canvas');
      const n = 20; c.width = n; c.height = n;
      const cx = c.getContext('2d');
      cx.drawImage(image, 0, 0, n, n);
      const { data } = cx.getImageData(0, 0, n, n);
      const buckets = {};
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        // skip near-white / near-black for the "vibrant" buckets
        r += R; g += G; b += B; cnt++;
        const key = `${R >> 5}-${G >> 5}-${B >> 5}`;
        buckets[key] = buckets[key] || { r: 0, g: 0, b: 0, n: 0 };
        buckets[key].r += R; buckets[key].g += G; buckets[key].b += B; buckets[key].n++;
      }
      const top = Object.values(buckets)
        .map(o => ({ hex: rgbToHex(o.r / o.n, o.g / o.n, o.b / o.n), n: o.n, sat: satOf(o.r / o.n, o.g / o.n, o.b / o.n) }))
        .sort((a, b) => (b.sat * 0.6 + b.n * 0.4) - (a.sat * 0.6 + a.n * 0.4))
        .slice(0, 5)
        .map(o => o.hex);
      const avg = cnt ? rgbToHex(r / cnt, g / cnt, b / cnt) : '#16a34a';
      const list = [...new Set([...top, avg])].slice(0, 6);
      setSwatches(list);
      if (!initialColor && list.length) setColor(list[0]);
    } catch {
      setSwatches([]);
    }
  };

  // ── Drag to reposition ──
  const onPointerDown = (e) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const base = { ...pan };
    dragRef.current = { start, base };
    const move = (ev) => {
      const d = dragRef.current; if (!d) return;
      setPan(clampPan({ x: d.base.x + (ev.clientX - d.start.x), y: d.base.y + (ev.clientY - d.start.y) }));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onWheel = (e) => {
    e.preventDefault();
    setScale(s => Math.min(6, Math.max(1, s * (e.deltaY < 0 ? 1.08 : 0.92))));
  };

  // ── Export cropped circle to PNG blob ──
  const buildBlob = () => new Promise((resolve, reject) => {
    if (!img) return reject(new Error('no image'));
    const canvas = document.createElement('canvas');
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.beginPath(); ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2); ctx.clip();
    // source rect of the image mapped to the circle bounding box
    const dw = img.naturalWidth * dispScale, dh = img.naturalHeight * dispScale;
    const px = STAGE / 2 - dw / 2 + pan.x;   // image top-left in stage coords
    const py = STAGE / 2 - dh / 2 + pan.y;
    const circLeft = STAGE / 2 - RADIUS, circTop = STAGE / 2 - RADIUS;
    const sx = (circLeft - px) / dispScale;
    const sy = (circTop - py) / dispScale;
    const sSize = (RADIUS * 2) / dispScale;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    ctx.restore();
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 0.92);
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const blob = await buildBlob();
      await onSave(blob, color);
    } catch (e) {
      setError(e.message || 'Erreur lors du recadrage.');
      setSaving(false);
    }
  };

  // stage image style
  const imgStyle = img ? {
    position: 'absolute',
    width: img.naturalWidth * dispScale,
    height: img.naturalHeight * dispScale,
    left: STAGE / 2 - (img.naturalWidth * dispScale) / 2 + pan.x,
    top: STAGE / 2 - (img.naturalHeight * dispScale) / 2 + pan.y,
    userSelect: 'none', pointerEvents: 'none', maxWidth: 'none',
  } : {};

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-700/60 shadow-2xl overflow-hidden animate-[fadeIn_.15s_ease]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="text-[11px] font-bold text-green-400 uppercase tracking-widest">Logo de filiale</div>
            <h3 className="text-lg font-extrabold text-slate-100">{filialeName}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Crop stage */}
          <div>
            <div
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              className="relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing mx-auto"
              style={{ width: STAGE, height: STAGE, maxWidth: '100%', background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 22px 22px' }}
            >
              {img && <img ref={imgRef} src={img.src} alt="" style={imgStyle} draggable={false} />}
              {/* circular mask */}
              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `0 0 0 9999px rgba(2,6,23,0.62)`, borderRadius: '50%', left: '50%', top: '50%', width: RADIUS * 2, height: RADIUS * 2, transform: 'translate(-50%,-50%)' }} />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div style={{ width: RADIUS * 2, height: RADIUS * 2, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.55)' }} />
              </div>
              {!img && !error && <div className="absolute inset-0 flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>}
              {error && <div className="absolute inset-0 flex items-center justify-center text-rose-400 text-sm px-6 text-center">{error}</div>}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1 pointer-events-none"><Move className="w-3 h-3" /> Glissez · molette pour zoomer</div>
            </div>
            {/* Zoom control */}
            <div className="flex items-center gap-3 mt-3">
              <ZoomIn className="w-4 h-4 text-slate-500" />
              <input type="range" min="1" max="6" step="0.01" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="flex-1 accent-green-500" />
              <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800" title="Réinitialiser"><RotateCcw className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Live preview + color */}
          <div className="flex flex-col">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Aperçu sur la carte</div>
            <div className="rounded-2xl border border-slate-800 overflow-hidden relative flex items-center justify-center gap-8 py-7" style={{ background: 'linear-gradient(135deg,#334155,#1e293b)' }}>
              {/* faux map texture */}
              <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg,#fff 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
              <MarkerPreview img={img} color={color} pan={pan} dispScale={dispScale} fallbackEmoji={fallbackEmoji} size={28} />
              <MarkerPreview img={img} color={color} pan={pan} dispScale={dispScale} fallbackEmoji={fallbackEmoji} size={64} />
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-5 mb-2">Couleur d'accent (pointe du marqueur)</div>
            <div className="flex items-center flex-wrap gap-2">
              {swatches.map(s => (
                <button key={s} onClick={() => setColor(s)} className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110" style={{ background: s, borderColor: color.toLowerCase() === s.toLowerCase() ? '#fff' : 'transparent' }} title={s} />
              ))}
              <label className="w-7 h-7 rounded-full overflow-hidden border-2 border-slate-600 relative cursor-pointer" title="Couleur personnalisée">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 w-[200%] h-[200%] -left-1/2 -top-1/2 cursor-pointer" />
              </label>
              <span className="text-xs text-slate-500 font-mono ml-1">{color}</span>
            </div>

            <div className="flex-1" />
            <div className="flex items-center gap-2 justify-end mt-6">
              <Button variant="outline" onClick={onCancel} className="border-slate-700">Annuler</Button>
              <Button onClick={handleSave} disabled={!img || saving} className="gap-2 bg-gradient-to-r from-green-500 to-lime-600 hover:from-green-600 hover:to-lime-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enregistrer le logo
              </Button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// The exact marker look used on the map, rendered live from the current crop.
function MarkerPreview({ img, color, pan, dispScale, fallbackEmoji, size }) {
  const circle = size;
  return (
    <div className="flex flex-col items-center" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' }}>
      <div style={{ width: circle, height: circle, borderRadius: '50%', border: `${Math.max(2, size / 12)}px solid #fff`, background: img ? '#fff' : filialeGradient(fallbackEmoji), overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {img
          ? <CroppedThumb img={img} pan={pan} dispScale={dispScale} size={circle} />
          : <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{fallbackEmoji}</span>}
      </div>
      <div style={{ width: 0, height: 0, borderLeft: `${size / 5}px solid transparent`, borderRight: `${size / 5}px solid transparent`, borderTop: `${size / 3.5}px solid ${color}`, marginTop: -1 }} />
    </div>
  );
}

// Renders the same circular crop as the export, scaled to `size`.
function CroppedThumb({ img, pan, dispScale, size }) {
  const ratio = size / (RADIUS * 2);
  const w = img.naturalWidth * dispScale * ratio;
  const h = img.naturalHeight * dispScale * ratio;
  const left = size / 2 - w / 2 + pan.x * ratio;
  const top = size / 2 - h / 2 + pan.y * ratio;
  return (
    <div style={{ position: 'relative', width: size, height: size, overflow: 'hidden', borderRadius: '50%' }}>
      <img src={img.src} alt="" draggable={false} style={{ position: 'absolute', width: w, height: h, left, top, maxWidth: 'none', pointerEvents: 'none' }} />
    </div>
  );
}

function filialeGradient() { return 'linear-gradient(135deg,#22c55e,#15803d)'; }

function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function satOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
