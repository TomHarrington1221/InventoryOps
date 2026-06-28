import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw, Search, ShieldAlert, Cpu, Terminal,
  Boxes, BarChart3, Layers, Plus, Minus, Trash2, X,
  ChevronUp, ChevronDown, Pencil, Package, ArrowDown, MapPin,
  Wine, Martini, CupSoda, Droplet, PlusCircle, ImagePlus, PackagePlus,
} from 'lucide-react';

// ── Demo placeholder image generator (offline data-URI, used to show image history) ──
const demoImg = (label, bg) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#0b1220"/></linearGradient></defs><rect width="200" height="280" fill="url(#g)"/><text x="100" y="150" fill="#fff" font-family="sans-serif" font-size="15" text-anchor="middle">${label}</text></svg>`);

// ── Product catalog (wine · spirits · canned cocktails) ──────────────────────
//  Units of measure:  Pallet → Cases → Eaches (bottles / cans).

const PRODUCTS = {
  'SKU-4501': { product: 'Estate Reserve Cabernet Sauvignon', category: 'Red Wine',        unit: 'Bottle', eachesPerCase: 12, casesPerPallet: 56, volumePerEach: 750,  volumeUnit: 'mL' },
  'SKU-4520': { product: 'Coastal Pinot Grigio',              category: 'White Wine',      unit: 'Bottle', eachesPerCase: 12, casesPerPallet: 56, volumePerEach: 750,  volumeUnit: 'mL' },
  'SKU-4533': { product: 'Maison Brut Sparkling',             category: 'Sparkling Wine',  unit: 'Bottle', eachesPerCase:  6, casesPerPallet: 90, volumePerEach: 750,  volumeUnit: 'mL' },
  'SKU-7710': { product: 'Highland Single Malt Whisky',       category: 'Whisky',          unit: 'Bottle', eachesPerCase:  6, casesPerPallet: 70, volumePerEach: 750,  volumeUnit: 'mL' },
  'SKU-7725': { product: 'Silver Agave Tequila Blanco',       category: 'Tequila',         unit: 'Bottle', eachesPerCase: 12, casesPerPallet: 60, volumePerEach: 750,  volumeUnit: 'mL' },
  'SKU-7740': { product: 'London Dry Gin',                    category: 'Gin',             unit: 'Bottle', eachesPerCase: 12, casesPerPallet: 54, volumePerEach: 1000, volumeUnit: 'mL' },
  'SKU-7755': { product: 'Reserve Vodka',                     category: 'Vodka',           unit: 'Bottle', eachesPerCase:  6, casesPerPallet: 50, volumePerEach: 1750, volumeUnit: 'mL' },
  'SKU-9120': { product: 'Gin & Tonic RTD',                   category: 'Canned Cocktail', unit: 'Can',    eachesPerCase: 24, casesPerPallet: 100,volumePerEach: 250,  volumeUnit: 'mL' },
  'SKU-9135': { product: 'Paloma Spritz RTD',                 category: 'Canned Cocktail', unit: 'Can',    eachesPerCase: 24, casesPerPallet: 84, volumePerEach: 355,  volumeUnit: 'mL' },
};
const SKU_LIST = Object.keys(PRODUCTS);

// Seed: { sku, cases, loose?, images? } = pallet, { inbound } = empty + replenishment en route.
const SEED = {
  '0-01-11': { sku: 'SKU-4501', cases: 55, loose: 7, images: [demoImg('Cabernet · v1', '#7f1d1d'), demoImg('Cabernet · v2', '#9f1239')] },
  '0-01-12': { sku: 'SKU-4501', cases:  6, loose: 3 },
  '0-01-21': { sku: 'SKU-4501', cases: 56 },
  '0-02-11': { inbound: true },
  '0-02-12': { sku: 'SKU-7725', cases:  5, loose: 4 },
  '0-02-21': { sku: 'SKU-7725', cases: 60 },
  '0-03-11': { sku: 'SKU-4533', cases: 40, loose: 5 },
  '0-03-12': { sku: 'SKU-4533', cases: 84 },
  '0-03-21': { sku: 'SKU-4533', cases: 90 },
  '0-04-21': { sku: 'SKU-7710', cases: 70 },
  '0-05-11': { sku: 'SKU-9120', cases: 55, loose: 9 },
  '0-05-21': { sku: 'SKU-9120', cases: 100 },
  '1-01-11': { sku: 'SKU-7740', cases: 44 },
  '1-01-12': { sku: 'SKU-7740', cases:  2, loose: 6 },
  '1-02-11': { sku: 'SKU-7755', cases: 18, loose: 2 },
  '1-03-11': { sku: 'SKU-4520', cases: 48 },
  '1-03-21': { sku: 'SKU-4520', cases: 56 },
  '1-04-11': { inbound: true },
  '1-05-11': { sku: 'SKU-9135', cases: 40, loose: 11 },
};

const POS_PER_LEVEL = 2;   // positions auto-stacked per level when adding locations

// ── Catalog visuals ──────────────────────────────────────────────────────────
const CATEGORY_VISUAL = {
  'Red Wine':        { Icon: Wine,    tint: 'from-rose-900/70 to-rose-950',    ring: 'border-rose-700/50',    text: 'text-rose-300'    },
  'White Wine':      { Icon: Wine,    tint: 'from-amber-700/50 to-amber-950',  ring: 'border-amber-600/50',   text: 'text-amber-200'   },
  'Sparkling Wine':  { Icon: Wine,    tint: 'from-yellow-600/50 to-amber-950', ring: 'border-yellow-600/50',  text: 'text-yellow-200'  },
  'Whisky':          { Icon: Martini, tint: 'from-orange-800/60 to-amber-950', ring: 'border-orange-700/50',  text: 'text-orange-200'  },
  'Tequila':         { Icon: Martini, tint: 'from-lime-800/50 to-emerald-950', ring: 'border-lime-700/50',    text: 'text-lime-200'    },
  'Gin':             { Icon: Martini, tint: 'from-sky-800/50 to-slate-950',    ring: 'border-sky-700/50',     text: 'text-sky-200'     },
  'Vodka':           { Icon: Martini, tint: 'from-indigo-800/50 to-slate-950', ring: 'border-indigo-700/50',  text: 'text-indigo-200'  },
  'Canned Cocktail': { Icon: CupSoda, tint: 'from-fuchsia-800/50 to-pink-950', ring: 'border-fuchsia-700/50', text: 'text-fuchsia-200' },
};
const visualFor = (cat) => CATEGORY_VISUAL[cat] || { Icon: Droplet, tint: 'from-slate-800 to-slate-950', ring: 'border-slate-700', text: 'text-slate-300' };

// ── Units-of-measure helpers ─────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const fmt  = (n) => Math.round(n).toLocaleString();
const plural = (u, n) => `${u}${n === 1 ? '' : 's'}`;

const maxEaches  = (p) => p.casesPerPallet * p.eachesPerCase;
const fillPct    = (p) => { const m = maxEaches(p); return m ? Math.round((p.eaches / m) * 100) : 0; };
const splitCases = (p) => ({ cases: Math.floor(p.eaches / p.eachesPerCase), loose: p.eaches % p.eachesPerCase });
const totalMl    = (p) => (p.volumePerEach ? p.eaches * p.volumePerEach : 0);
const fmtVolume  = (ml) => !ml ? '—' : ml >= 1000 ? `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L` : `${fmt(ml)} mL`;
const latestImage = (p) => (p.images && p.images.length ? p.images[p.images.length - 1] : '');

function makePallet(sku, eaches, images = []) {
  const m = PRODUCTS[sku];
  return { sku, product: m.product, category: m.category, unit: m.unit, eachesPerCase: m.eachesPerCase,
    casesPerPallet: m.casesPerPallet, volumePerEach: m.volumePerEach, volumeUnit: m.volumeUnit, images, eaches };
}
const seedEaches = (sd, m) => (sd.cases || 0) * m.eachesPerCase + (sd.loose || 0);

// Build the starting demo warehouse as { aisles, bays, slots } so it can be extended.
function buildWarehouse() {
  const aisles = [], bays = [], slots = [];
  for (let a = 0; a < 2; a++) {
    aisles.push({ name: String(a) });
    for (let b = 1; b <= 6; b++) {
      const bn = pad2(b);
      bays.push({ aisle: String(a), name: bn });
      for (let l = 1; l <= 3; l++) for (let p = 1; p <= 2; p++) {
        const code = `${a}-${bn}-${l}${p}`;
        const sd = SEED[code]; let pallet = null, inbound = false;
        if (sd?.inbound) inbound = true;
        else if (sd) pallet = makePallet(sd.sku, seedEaches(sd, PRODUCTS[sd.sku]), sd.images || []);
        slots.push({ code, aisle: String(a), bay: bn, level: l, position: p, primary: l === 1, pallet, inbound });
      }
    }
  }
  return { aisles, bays, slots };
}

// Next free (level, position) in row-major order for a bay's existing locations.
function nextLocation(locs) {
  const used = new Set(locs.map((s) => `${s.level}-${s.position}`));
  for (let i = 0; ; i++) {
    const level = Math.floor(i / POS_PER_LEVEL) + 1, position = (i % POS_PER_LEVEL) + 1;
    if (!used.has(`${level}-${position}`)) return { level, position };
  }
}

function barColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 30) return '#f59e0b';
  if (pct > 0)   return '#ef4444';
  return '#1e293b';
}
function slotStatus(slot) {
  if (!slot.pallet) {
    if (slot.inbound) return { empty: true, pct: 0, label: 'Replenishing', cardStyle: 'bg-black border-blue-500 text-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]' };
    return { empty: true, pct: 0, label: 'Empty', cardStyle: 'bg-slate-950 border-slate-800 text-slate-600' };
  }
  const pct = fillPct(slot.pallet);
  if (slot.inbound && pct < 30) return { pct, label: 'Critical + Pending', cardStyle: 'bg-black border-blue-400 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]' };
  if (pct >= 80) return { pct, label: 'Full',             cardStyle: 'bg-emerald-950/80 border-emerald-500 text-emerald-300' };
  if (pct >= 30) return { pct, label: 'Attention Needed', cardStyle: 'bg-amber-950/80 border-amber-500 text-amber-300' };
  return           { pct, label: 'Low Stock',             cardStyle: 'bg-red-950/80 border-red-500 text-red-300' };
}
function badgeStyle(pct) {
  if (pct >= 80) return 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50';
  if (pct >= 30) return 'bg-amber-900/40 text-amber-400 border border-amber-500/50';
  return 'bg-red-900/40 text-red-400 border border-red-500/50';
}
function classifyDrop(src, tgt) {
  if (!src?.pallet)          return { ok: false, reason: 'no pallet to move' };
  if (src.code === tgt.code) return { ok: false, reason: 'is the same slot' };
  if (tgt.pallet) {
    if (tgt.pallet.sku === src.pallet.sku) return { ok: true, mode: 'merge' };
    return { ok: false, reason: `already holds ${tgt.pallet.sku} — only ${src.pallet.sku} or an empty slot accepts this pallet` };
  }
  return { ok: true, mode: 'move' };
}
function groupLevels(baySlots) {
  const o = {};
  baySlots.forEach((s) => { (o[s.level] ||= []).push(s); });
  Object.values(o).forEach((arr) => arr.sort((a, b) => a.position - b.position));
  return o;
}

// ── Form primitives ──────────────────────────────────────────────────────────
function Field({ label, value, onChange, disabled = false, mono = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
        className={`w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition disabled:opacity-40 ${mono ? 'font-mono' : ''}`} />
    </div>
  );
}
function NumberField({ label, value, onChange, min = 0, max }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => { const n = Number(e.target.value); onChange(max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n)); }}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 transition" />
    </div>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}

// ── Product thumbnail (image or category placeholder) ────────────────────────
function ProductThumb({ pallet, src, className = '', iconSize = 40 }) {
  const v = visualFor(pallet.category);
  const url = src !== undefined ? src : latestImage(pallet);
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [url]);
  if (url && !err) return <img src={url} alt={pallet.product} onError={() => setErr(true)} className={`object-cover ${className}`} />;
  const Icon = v.Icon;
  return <div className={`bg-gradient-to-b ${v.tint} border ${v.ring} flex items-center justify-center ${className}`}><Icon size={iconSize} className={`${v.text} opacity-90`} /></div>;
}

// ── Modal chrome ─────────────────────────────────────────────────────────────
function Shell({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">{icon}{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-md p-1 transition"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Metric({ big, label, sub, accent = false }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
      <p className={`text-lg font-bold font-mono leading-none ${accent ? 'text-cyan-300' : 'text-slate-100'}`}>{big}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{label}</p>
      <p className="text-[9px] text-slate-600 font-mono mt-0.5">{sub}</p>
    </div>
  );
}

// ── Location detail / edit / place modal ─────────────────────────────────────
function LocationModal({ slot, mode, onPlace, onSaveEdit, onAdjust, onEmpty, onClose }) {
  const placing = mode === 'place' || !slot.pallet;
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(null);
  const [imgIdx, setImgIdx]   = useState(-1);          // history preview (-1 = latest)
  // placement state
  const [pSku, setPSku]       = useState(SKU_LIST[0]);
  const [pQuery, setPQuery]   = useState('');
  const [pCases, setPCases]   = useState(0);
  const [pLoose, setPLoose]   = useState(0);
  const [pInbound, setPInbound] = useState(false);
  // pick / receive state
  const [pickAmt, setPickAmt] = useState('');
  const [pickUnit, setPickUnit] = useState('Cases');
  const [recvAmt, setRecvAmt] = useState('');
  const [recvUnit, setRecvUnit] = useState('Cases');

  useEffect(() => { const h = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  // ── Placement form ─────────────────────────────────────────────────────────
  if (placing) {
    const meta = PRODUCTS[pSku];
    const eaches = pCases * meta.eachesPerCase + pLoose;
    const cap = meta.casesPerPallet * meta.eachesPerCase;
    const q = pQuery.trim().toLowerCase();
    const matches = q ? SKU_LIST.filter((s) => [s, PRODUCTS[s].product, PRODUCTS[s].category].some((x) => x.toLowerCase().includes(q))) : SKU_LIST;
    return (
      <Shell title={`Add Pallet · ${slot.code}`} icon={<PackagePlus size={16} className="text-cyan-400" />} onClose={onClose}>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Find Item — SKU or name search</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={pQuery} onChange={(e) => setPQuery(e.target.value)} placeholder="e.g. cabernet, gin, SKU-95…"
                className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {matches.map((s) => (
                <button key={s} onClick={() => setPSku(s)}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md border transition ${pSku === s ? 'bg-blue-950/50 border-blue-600' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'}`}>
                  <ProductThumb pallet={makePallet(s, 0)} className="w-6 h-8 rounded flex-none" iconSize={14} />
                  <span className="min-w-0"><span className="block text-[11px] font-bold text-slate-200 truncate">{PRODUCTS[s].product}</span>
                    <span className="block text-[9px] font-mono text-slate-500">{s} · {PRODUCTS[s].category} · {PRODUCTS[s].eachesPerCase}/case</span></span>
                </button>
              ))}
              {matches.length === 0 && <p className="text-[10px] text-slate-600 font-mono px-2 py-1">No items match “{pQuery}”.</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <ProductThumb pallet={makePallet(pSku, eaches)} className="w-12 h-16 rounded-md flex-none" iconSize={24} />
            <div className="text-[11px] text-slate-300 leading-relaxed min-w-0">
              <p className="font-bold text-slate-100 truncate">{meta.product}</p>
              <p className="text-slate-500">{meta.category} · {meta.eachesPerCase} {plural(meta.unit, 2).toLowerCase()}/case · full pallet {meta.casesPerPallet} cs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setPCases(meta.casesPerPallet); setPLoose(0); }}
              className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-cyan-950/60 border border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50 transition">Full Pallet ({meta.casesPerPallet} cs)</button>
            <span className="text-[10px] text-slate-600">or enter a quantity ↓</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Cases" value={pCases} min={0} max={meta.casesPerPallet} onChange={setPCases} />
            <NumberField label={`Loose ${plural(meta.unit, 2)}`} value={pLoose} min={0} max={meta.eachesPerCase - 1} onChange={setPLoose} />
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Liquid</label>
              <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-cyan-300">{fmtVolume(eaches * meta.volumePerEach)}</div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5"><Toggle label="Replenishment In Transit" checked={pInbound} onChange={setPInbound} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
          <button onClick={() => onPlace(slot.code, pSku, pCases, pLoose, pInbound)} disabled={eaches <= 0 || eaches > cap}
            className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold transition">Add Pallet</button>
        </div>
      </Shell>
    );
  }

  // ── Detail view (occupied) ───────────────────────────────────────────────────
  const p = slot.pallet;
  const v = visualFor(p.category);
  const { cases, loose } = splitCases(p);
  const pct = fillPct(p);
  const st  = slotStatus(slot);
  const ml  = totalMl(p);
  const imgs = p.images || [];
  const shownIdx = imgIdx < 0 || imgIdx >= imgs.length ? imgs.length - 1 : imgIdx;
  const shownSrc = imgs.length ? imgs[shownIdx] : '';

  const doPick = () => { const n = parseInt(pickAmt, 10); if (n > 0) { onAdjust(slot.code, -(pickUnit === 'Cases' ? n * p.eachesPerCase : n)); setPickAmt(''); } };
  const doRecv = () => { const n = parseInt(recvAmt, 10); if (n > 0) { onAdjust(slot.code, +(recvUnit === 'Cases' ? n * p.eachesPerCase : n)); setRecvAmt(''); } };

  const startEdit = () => {
    setForm({ product: p.product, category: p.category, sku: p.sku, unit: p.unit, eachesPerCase: p.eachesPerCase, casesPerPallet: p.casesPerPallet,
      volumePerEach: p.volumePerEach, volumeUnit: p.volumeUnit, images: [...imgs], newImage: '', cases, loose, inbound: slot.inbound });
    setEditing(true);
  };
  const setF = (k, val) => setForm((f) => ({ ...f, [k]: val }));

  return (
    <Shell
      title={<span className="flex items-center gap-2 font-mono">{slot.code}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${slot.primary ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'}`}>{slot.primary ? 'PRIMARY' : 'RESERVE'}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeStyle(pct)}`}>{st.label}</span></span>}
      icon={<MapPin size={16} className="text-cyan-400" />} onClose={onClose}>

      {/* Identity + image (with version history) */}
      <div className="flex gap-4">
        <div className="flex-none">
          <ProductThumb pallet={p} src={shownSrc} className="w-24 h-32 rounded-lg shadow-lg" iconSize={44} />
          {imgs.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1.5 flex-wrap">
                {imgs.map((u, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} title={i === imgs.length - 1 ? 'Current image' : `Version ${i + 1}`}
                    className={`relative w-7 h-9 rounded overflow-hidden border ${i === shownIdx ? 'border-cyan-400' : 'border-slate-700'}`}>
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    {i === imgs.length - 1 && <span className="absolute inset-x-0 bottom-0 bg-cyan-500/80 text-[6px] text-center text-slate-950 font-bold leading-tight">NOW</span>}
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-slate-600 mt-1">{imgs.length} image version{imgs.length > 1 ? 's' : ''} · newest is main</p>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-100 leading-tight">{p.product}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-400 font-mono">
            <span>{p.sku}</span><span className={v.text}>{p.category}</span>
            <span>{p.eachesPerCase} {plural(p.unit, 2).toLowerCase()}/case</span><span>{p.volumePerEach} {p.volumeUnit}/{p.unit.toLowerCase()}</span>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor(pct) }} /></div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1"><span>{cases} / {p.casesPerPallet} cases</span><span>{pct}% full</span></div>
          </div>
        </div>
      </div>

      {/* Metrics — Bottles shows LOOSE singles available, not cases × per-case */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Metric big={fmt(cases)} label="cases" sub="full cases in location" />
        <Metric big={fmt(loose)} label={`loose ${plural(p.unit, 2).toLowerCase()}`} sub="available as singles" accent />
        <Metric big={fmtVolume(ml)} label="liquid contents" sub={`${p.volumePerEach} ${p.volumeUnit} each`} />
        <Metric big={`${pct}%`} label="pallet fill" sub={`${fmt(p.eaches)} of ${fmt(maxEaches(p))} ${plural(p.unit, 2).toLowerCase()}`} />
      </div>

      {/* Pick (left) / Receive (right) */}
      {!editing && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3">
            <p className="text-[11px] font-bold text-red-300 uppercase tracking-wider mb-2 flex items-center gap-1"><Minus size={11} /> Pick</p>
            <div className="flex gap-1.5">
              <input value={pickAmt} onChange={(e) => setPickAmt(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-red-500" />
              <UnitBtn unit={pickUnit} setUnit={setPickUnit} p={p} />
            </div>
            <button onClick={doPick} className="w-full mt-2 text-[11px] font-bold py-1.5 rounded-md bg-red-900/40 border border-red-700/50 text-red-200 hover:bg-red-800/50 transition">Pick</button>
            <button onClick={() => onAdjust(slot.code, -p.eaches, 'a full pallet')} className="w-full mt-1.5 text-[10px] py-1 rounded-md border border-red-900/50 text-red-300/80 hover:bg-red-950/40 transition">Pick Full Pallet</button>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3">
            <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1"><Plus size={11} /> Receive</p>
            <div className="flex gap-1.5">
              <input value={recvAmt} onChange={(e) => setRecvAmt(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500" />
              <UnitBtn unit={recvUnit} setUnit={setRecvUnit} p={p} />
            </div>
            <button onClick={doRecv} className="w-full mt-2 text-[11px] font-bold py-1.5 rounded-md bg-emerald-900/40 border border-emerald-700/50 text-emerald-200 hover:bg-emerald-800/50 transition">Receive</button>
            <button onClick={() => onAdjust(slot.code, maxEaches(p) - p.eaches, 'a full pallet')} className="w-full mt-1.5 text-[10px] py-1 rounded-md border border-emerald-900/50 text-emerald-300/80 hover:bg-emerald-950/40 transition">Receive Full Pallet</button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-4 border-t border-slate-800 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SKU</label>
              <select value={form.sku} onChange={(e) => { const m = PRODUCTS[e.target.value]; setForm((f) => ({ ...f, sku: e.target.value, product: m.product, category: m.category, unit: m.unit, eachesPerCase: m.eachesPerCase, casesPerPallet: m.casesPerPallet, volumePerEach: m.volumePerEach, volumeUnit: m.volumeUnit })); }}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500">
                {SKU_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Category" value={form.category} onChange={(x) => setF('category', x)} />
          </div>
          <Field label="Product Description" value={form.product} onChange={(x) => setF('product', x)} />
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Cases" value={form.cases} min={0} max={form.casesPerPallet} onChange={(x) => setF('cases', x)} />
            <NumberField label={`Loose ${plural(form.unit, 2)}`} value={form.loose} min={0} max={form.eachesPerCase - 1} onChange={(x) => setF('loose', x)} />
            <NumberField label="Cases / Pallet" value={form.casesPerPallet} min={1} onChange={(x) => setF('casesPerPallet', x)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label={`${plural(form.unit, 2)} / Case`} value={form.eachesPerCase} min={1} onChange={(x) => setF('eachesPerCase', x)} />
            <NumberField label={`Volume / ${form.unit}`} value={form.volumePerEach} min={0} onChange={(x) => setF('volumePerEach', x)} />
            <Field label="Vol Unit" value={form.volumeUnit} onChange={(x) => setF('volumeUnit', x)} mono />
          </div>
          {/* Image versions */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Product Images — newest becomes the main</label>
            {form.images.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {form.images.map((u, i) => (
                  <div key={i} className="relative w-9 h-12 rounded overflow-hidden border border-slate-700">
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setF('images', form.images.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/70 text-red-300 w-4 h-4 leading-none text-[10px]">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input value={form.newImage} onChange={(e) => setF('newImage', e.target.value)} placeholder="paste image URL…"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500" />
              <button onClick={() => { if (form.newImage.trim()) setForm((f) => ({ ...f, images: [...f.images, f.newImage.trim()], newImage: '' })); }}
                className="flex-none flex items-center gap-1 text-[11px] font-bold px-2.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition"><ImagePlus size={12} /> Add</button>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5"><Toggle label="Replenishment In Transit" checked={form.inbound} onChange={(x) => setF('inbound', x)} /></div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
        <button onClick={() => onEmpty(slot.code)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition"><Trash2 size={12} /> Empty Slot</button>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
            <button onClick={() => { onSaveEdit(slot.code, form); setEditing(false); setImgIdx(-1); }} className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition">Save Changes</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={startEdit} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"><Pencil size={12} /> Edit Details</button>
            <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition">Done</button>
          </div>
        )}
      </div>
    </Shell>
  );
}
function UnitBtn({ unit, setUnit, p }) {
  const other = unit === 'Cases' ? plural(p.unit, 2) : 'Cases';
  return <button onClick={() => setUnit(unit === 'Cases' ? plural(p.unit, 2) : 'Cases')} title={`Switch to ${other}`}
    className="flex-none text-[10px] font-bold px-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition whitespace-nowrap">{unit}</button>;
}

// ── Single location cell ──────────────────────────────────────────────────────
function SlotCell({ slot, dragSlot, onPick, onDragStart, onDragEnd, onDrop, onRemove }) {
  const st  = slotStatus(slot);
  const has = !!slot.pallet;
  const loc = slot.code.slice(-2);
  let drop = null;
  if (dragSlot) drop = dragSlot.code === slot.code ? 'self' : (classifyDrop(dragSlot, slot).ok ? 'ok' : 'bad');
  const ring = drop === 'ok' ? 'ring-2 ring-emerald-400/70' : drop === 'bad' ? 'ring-2 ring-red-500/60' : drop === 'self' ? 'opacity-40' : '';
  const v = has ? visualFor(slot.pallet.category) : null;
  const Icon = v?.Icon;
  const cases = has ? splitCases(slot.pallet).cases : 0;
  return (
    <div draggable={has}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', slot.code); onDragStart(slot); }}
      onDragEnd={onDragEnd} onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), slot.code); }}
      onClick={() => onPick(slot)} title={slot.code}
      className={`relative rounded-lg border p-2 h-[70px] flex flex-col justify-between select-none transition hover:brightness-110 ${st.cardStyle} ${ring} ${has ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] font-bold tracking-wider opacity-80">{loc}</span>
        {slot.primary && <span className="text-[7px] font-bold px-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 leading-tight">PRIMARY</span>}
        {!has && onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(slot.code); }} title="Remove location" className="text-slate-700 hover:text-red-400 leading-none">×</button>}
      </div>
      {has ? (
        <>
          <div className="flex items-center gap-1 leading-tight min-w-0">
            {Icon && <Icon size={12} className={`${v.text} flex-none`} />}
            <div className="min-w-0"><p className="text-[9px] font-bold line-clamp-1">{slot.pallet.product}</p><p className="text-[8px] font-mono opacity-60">{slot.pallet.sku}</p></div>
          </div>
          <div>
            <div className="h-1 bg-black/40 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${st.pct}%`, backgroundColor: barColor(st.pct) }} /></div>
            <div className="flex justify-between items-center mt-0.5"><span className="text-[8px] font-mono opacity-70">{fmt(cases)} cs</span><span className="text-[8px] font-mono font-bold">{st.pct}%</span></div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center"><span className="text-[9px] font-mono tracking-widest">{slot.inbound ? 'INBOUND' : 'EMPTY'}</span></div>
      )}
    </div>
  );
}

// ── Bay rack (with builder controls) ─────────────────────────────────────────
function BayRack({ aisle, bay, levels, side, dragSlot, onPick, onDragStart, onDragEnd, onDrop, onAddLocation, onRemoveLocation, onRemoveBay }) {
  const lvls = Object.keys(levels).map(Number).sort((a, b) => b - a);   // floor at the bottom
  const all = lvls.flatMap((l) => levels[l]);
  const occ = all.filter((s) => s.pallet).length;
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] font-bold text-slate-300 flex items-center gap-1"><Layers size={10} className="text-slate-500" /> BAY {bay}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[8px] font-mono text-slate-500">{side} · {occ}/{all.length}</span>
          {all.length === 0 && <button onClick={() => onRemoveBay(aisle, bay)} title="Remove empty bay" className="text-slate-700 hover:text-red-400 text-xs leading-none">×</button>}
        </span>
      </div>
      {all.length === 0 ? (
        <button onClick={() => onAddLocation(aisle, bay)} className="w-full h-[70px] rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-cyan-600 hover:text-cyan-400 transition flex flex-col items-center justify-center gap-1 text-[10px] font-mono">
          <PlusCircle size={16} /> Add first location
        </button>
      ) : (
        <div className="space-y-1">
          {lvls.map((l) => (
            <div key={l} className="flex items-stretch gap-1">
              <div className={`w-5 flex items-center justify-center rounded text-[8px] font-mono font-bold ${l === 1 ? 'bg-cyan-900/40 text-cyan-300' : 'bg-slate-800/60 text-slate-500'}`}>L{l}</div>
              <div className="grid grid-cols-2 gap-1 flex-1">
                {levels[l].map((s) => <SlotCell key={s.code} slot={s} dragSlot={dragSlot} onPick={onPick} onDragStart={onDragStart} onDragEnd={onDragEnd} onDrop={onDrop} onRemove={onRemoveLocation} />)}
              </div>
            </div>
          ))}
          <button onClick={() => onAddLocation(aisle, bay)} className="w-full mt-1 text-[9px] font-mono text-slate-500 hover:text-cyan-400 border border-dashed border-slate-800 hover:border-cyan-700 rounded-md py-1 transition flex items-center justify-center gap-1"><Plus size={10} /> Add location</button>
        </div>
      )}
    </div>
  );
}
function AisleLane({ aisle }) {
  return (
    <div className="flex flex-col items-center justify-center bg-slate-800/30 border border-slate-800 rounded-lg py-2">
      <ArrowDown size={12} className="text-slate-600" />
      <span className="my-2 font-mono text-[9px] font-bold text-slate-400 tracking-widest [writing-mode:vertical-rl] rotate-180">AISLE {aisle}</span>
      <ArrowDown size={12} className="text-slate-600 rotate-180" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EagleView() {
  const [activeTab, setActiveTab]   = useState('layout');
  const [wh, setWh]                 = useState(buildWarehouse);
  const { aisles, bays, slots }     = wh;
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs]             = useState([
    { time: '13:02:11', type: 'system', message: 'Spatial telemetry online. 2 primary slots flagged for autonomous replenishment.' },
    { time: '12:54:10', type: 'ai',     message: 'AI demand models recalculated using regional logistics telemetry.' },
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [modal, setModal]           = useState(null);
  const [collapsed, setCollapsed]   = useState({});
  const [dragCode, setDragCode]     = useState(null);
  const [sortKey, setSortKey]       = useState('code');
  const [sortDir, setSortDir]       = useState('asc');

  const addLog = useCallback((type, message) => setLogs((prev) => [{ time: new Date().toLocaleTimeString(), type, message }, ...prev]), []);
  const updateSlots = useCallback((fn) => setWh((prev) => ({ ...prev, slots: fn(prev.slots) })), []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const byCode = useMemo(() => { const m = {}; slots.forEach((s) => { m[s.code] = s; }); return m; }, [slots]);
  const layout = useMemo(() => {
    const m = {};
    aisles.forEach((a) => { m[a.name] = {}; });
    bays.forEach((b) => { (m[b.aisle] ??= {})[b.name] = []; });
    slots.forEach((s) => { (m[s.aisle] ??= {}); (m[s.aisle][s.bay] ??= []).push(s); });
    return m;
  }, [aisles, bays, slots]);

  const stats = useMemo(() => {
    const occupied = slots.filter((s) => s.pallet);
    const primaries = slots.filter((s) => s.primary);
    const stocked = primaries.filter((s) => s.pallet && fillPct(s.pallet) >= 30);
    return {
      total: slots.length, occupied: occupied.length, skus: new Set(occupied.map((s) => s.pallet.sku)).size,
      emptyPrimaries: primaries.filter((s) => !s.pallet).length, inbound: slots.filter((s) => s.inbound).length,
      cases: occupied.reduce((t, s) => t + splitCases(s.pallet).cases, 0),
      liters: occupied.reduce((t, s) => t + totalMl(s.pallet), 0) / 1000,
      health: primaries.length ? Math.round((stocked.length / primaries.length) * 100) : 0,
    };
  }, [slots]);

  const pallets = useMemo(() => slots.filter((s) => s.pallet).map((s) => ({ code: s.code, primary: s.primary, ...s.pallet })), [slots]);
  const filteredPallets = useMemo(() => {
    if (!searchTerm.trim()) return pallets;
    const t = searchTerm.toLowerCase();
    return pallets.filter((p) => [p.code, p.sku, p.product, p.category].some((x) => x.toLowerCase().includes(t)));
  }, [pallets, searchTerm]);
  const sortedPallets = useMemo(() => {
    const rows = [...filteredPallets];
    rows.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'fill') { av = fillPct(a); bv = fillPct(b); }
      if (sortKey === 'cases') { av = a.eaches; bv = b.eaches; }
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return av < bv ? (sortDir === 'asc' ? -1 : 1) : av > bv ? (sortDir === 'asc' ? 1 : -1) : 0;
    });
    return rows;
  }, [filteredPallets, sortKey, sortDir]);

  // ── Pallet ops ───────────────────────────────────────────────────────────────
  const movePallet = useCallback((srcCode, tgtCode) => {
    const src = byCode[srcCode], tgt = byCode[tgtCode];
    if (!src || !tgt) return;
    const res = classifyDrop(src, tgt);
    if (!res.ok) { addLog('warning', `Move blocked — ${tgtCode} ${res.reason}.`); return; }
    if (res.mode === 'merge') {
      const moved = Math.min(maxEaches(tgt.pallet) - tgt.pallet.eaches, src.pallet.eaches);
      const left = src.pallet.eaches - moved;
      updateSlots((prev) => prev.map((s) => s.code === tgtCode ? { ...s, pallet: { ...s.pallet, eaches: s.pallet.eaches + moved }, inbound: false }
        : s.code === srcCode ? { ...s, pallet: left > 0 ? { ...s.pallet, eaches: left } : null } : s));
      addLog('system', `Replenished ${tgtCode} with ${fmt(moved)} ${plural(src.pallet.unit, moved).toLowerCase()} of ${src.pallet.sku} from ${srcCode}.`);
    } else {
      updateSlots((prev) => prev.map((s) => s.code === tgtCode ? { ...s, pallet: src.pallet, inbound: false } : s.code === srcCode ? { ...s, pallet: null } : s));
      addLog('system', `Moved ${src.pallet.sku} pallet ${srcCode} → ${tgtCode}.`);
    }
  }, [byCode, addLog, updateSlots]);
  const onDropMove = useCallback((srcCode, tgtCode) => { setDragCode(null); if (srcCode && srcCode !== tgtCode) movePallet(srcCode, tgtCode); }, [movePallet]);

  const adjustEaches = useCallback((code, delta, note) => {
    const s = byCode[code]; if (!s?.pallet) return;
    const next = Math.max(0, Math.min(maxEaches(s.pallet), s.pallet.eaches + delta));
    if (next === s.pallet.eaches) { addLog('warning', `${code} ${delta > 0 ? 'at full pallet capacity' : 'already empty'} — no change.`); return; }
    updateSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, eaches: next }, inbound: next > 0 ? false : x.inbound } : x));
    const qty = Math.abs(delta), what = note || (qty === s.pallet.eachesPerCase ? '1 case' : `${fmt(qty)} ${plural(s.pallet.unit, qty).toLowerCase()}`);
    addLog('system', `${delta > 0 ? 'Received' : 'Picked'} ${what} ${delta > 0 ? 'into' : 'from'} ${code} — now ${splitCases({ ...s.pallet, eaches: next }).cases} cs / ${fmt(next)} ${plural(s.pallet.unit, next).toLowerCase()}.`);
  }, [byCode, addLog, updateSlots]);

  const saveEdit = useCallback((code, form) => {
    const eaches = Math.min(form.cases * form.eachesPerCase + form.loose, form.casesPerPallet * form.eachesPerCase);
    updateSlots((prev) => prev.map((s) => s.code === code ? { ...s, inbound: form.inbound,
      pallet: { sku: form.sku, product: form.product, category: form.category, unit: form.unit, eachesPerCase: form.eachesPerCase, casesPerPallet: form.casesPerPallet, volumePerEach: form.volumePerEach, volumeUnit: form.volumeUnit, images: form.images, eaches } } : s));
    addLog('system', `${code} updated — ${form.sku}, ${form.cases} cs.`);
  }, [addLog, updateSlots]);

  const placePallet = useCallback((code, sku, cases, loose, inbound) => {
    const m = PRODUCTS[sku];
    const eaches = Math.min(cases * m.eachesPerCase + loose, m.casesPerPallet * m.eachesPerCase);
    updateSlots((prev) => prev.map((s) => s.code === code ? { ...s, inbound, pallet: makePallet(sku, eaches) } : s));
    addLog('system', `Placed ${sku} (${m.product}) at ${code} — ${cases} cs.`);
    setModal(null);
  }, [addLog, updateSlots]);

  const emptySlot = useCallback((code) => { updateSlots((prev) => prev.map((s) => s.code === code ? { ...s, pallet: null } : s)); addLog('warning', `${code} emptied — pallet removed.`); setModal(null); }, [addLog, updateSlots]);
  const onPick = useCallback((slot) => setModal({ code: slot.code, mode: slot.pallet ? 'detail' : 'place' }), []);

  // ── Builder ops ──────────────────────────────────────────────────────────────
  const addAisle = useCallback(() => {
    setWh((prev) => { const next = prev.aisles.length ? Math.max(...prev.aisles.map((a) => +a.name)) + 1 : 0; return { ...prev, aisles: [...prev.aisles, { name: String(next) }] }; });
    addLog('system', 'Added a new aisle.');
  }, [addLog]);
  const addBay = useCallback((aisle) => {
    setWh((prev) => { const inA = prev.bays.filter((b) => b.aisle === aisle); const n = inA.length ? Math.max(...inA.map((b) => +b.name)) + 1 : 1; return { ...prev, bays: [...prev.bays, { aisle, name: pad2(n) }] }; });
    addLog('system', `Added a bay to aisle ${aisle}.`);
  }, [addLog]);
  const addLocation = useCallback((aisle, bay) => {
    setWh((prev) => { const here = prev.slots.filter((s) => s.aisle === aisle && s.bay === bay); const { level, position } = nextLocation(here);
      const code = `${aisle}-${bay}-${level}${position}`;
      return { ...prev, slots: [...prev.slots, { code, aisle, bay, level, position, primary: level === 1, pallet: null, inbound: false }] }; });
    addLog('system', `Added a location to bay ${aisle}-${bay}.`);
  }, [addLog]);
  const removeLocation = useCallback((code) => { setWh((prev) => ({ ...prev, slots: prev.slots.filter((s) => s.code !== code) })); addLog('warning', `Removed location ${code}.`); }, [addLog]);
  const removeBay = useCallback((aisle, bay) => { setWh((prev) => ({ ...prev, bays: prev.bays.filter((b) => !(b.aisle === aisle && b.name === bay)) })); addLog('warning', `Removed empty bay ${aisle}-${bay}.`); }, [addLog]);
  const removeAisle = useCallback((aisle) => {
    setWh((prev) => prev.bays.some((b) => b.aisle === aisle) ? prev : { ...prev, aisles: prev.aisles.filter((a) => a.name !== aisle) });
    addLog('warning', `Removed aisle ${aisle} (if empty).`);
  }, [addLog]);

  // ── Terminal ─────────────────────────────────────────────────────────────────
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    const raw = terminalInput.trim(); if (!raw) return;
    setTerminalInput('');
    const cmd = raw.toLowerCase(), parts = raw.split(/\s+/), now = new Date().toLocaleTimeString();
    let response = '';
    if (cmd === 'clear') { setLogs([]); return; }
    if (cmd === 'help') response = 'Commands: move <src> <dst> · pick <code> <n> · receive <code> <n> · fill <code> · drain <code> · restock · status · clear · help';
    else if (cmd === 'status') response = `Slots ${stats.total} | Occupied ${stats.occupied} | Empty primaries ${stats.emptyPrimaries} | Inbound ${stats.inbound} | Cases ${fmt(stats.cases)} | Liquid ${stats.liters.toFixed(1)} L`;
    else if (cmd.startsWith('move ')) { const [, a, b] = parts; if (byCode[a] && byCode[b]) { movePallet(a, b); response = `move ${a} → ${b} processed.`; } else response = 'Unknown location(s). e.g. "move 0-01-21 0-01-11".'; }
    else if (cmd.startsWith('pick ') || cmd.startsWith('receive ')) { const code = parts[1], n = parseInt(parts[2], 10); if (byCode[code]?.pallet && n > 0) { adjustEaches(code, cmd.startsWith('pick') ? -n : n); response = `${parts[0]} ${n} @ ${code} processed.`; } else response = `Usage: ${parts[0]} <code> <n>.`; }
    else if (cmd.startsWith('fill ')) { const code = parts[1], s = byCode[code]; if (s?.pallet) { updateSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, eaches: Math.floor(maxEaches(x.pallet) * 0.9) }, inbound: false } : x)); response = `${code} filled to 90%.`; } else response = s ? `${code} is empty.` : `"${code}" not found.`; }
    else if (cmd.startsWith('drain ')) { const code = parts[1], s = byCode[code]; if (s?.pallet) { updateSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, eaches: 0 } } : x)); response = `${code} drained to 0.`; } else response = s ? `${code} already empty.` : `"${code}" not found.`; }
    else if (cmd === 'restock') { updateSlots((prev) => prev.map((x) => x.pallet && fillPct(x.pallet) < 30 ? { ...x, pallet: { ...x.pallet, eaches: Math.floor(maxEaches(x.pallet) * 0.85) }, inbound: false } : x)); response = 'Low pallets restocked to 85%.'; }
    else response = `Unknown command "${raw}". Type "help".`;
    setLogs((prev) => [{ time: now, type: 'ai', message: response }, { time: now, type: 'user', message: `> ${raw}` }, ...prev]);
  };

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const handleSort = (key) => { if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('asc'); } };
  const SortHead = ({ col, label }) => (
    <th onClick={() => handleSort(col)} className="pb-3 pr-4 font-medium cursor-pointer select-none hover:text-slate-200 transition group">
      <span className="flex items-center gap-1">{label}<span className="text-slate-700 group-hover:text-slate-400 transition">{sortKey === col ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ChevronUp size={10} className="opacity-0 group-hover:opacity-40" />}</span></span>
    </th>
  );
  const dragSlot = dragCode ? byCode[dragCode] : null;
  const toggleAisle = (a) => setCollapsed((c) => ({ ...c, [a]: !c[a] }));
  const resetSim = () => { setWh(buildWarehouse()); setSearchTerm(''); setDragCode(null); setModal(null); addLog('system', 'Simulation reset to seed layout.'); };

  const renderBay = (a, b) => (
    <BayRack key={`${a}-${b}`} aisle={a} bay={b} levels={groupLevels(layout[a]?.[b] || [])} side={(+b) % 2 ? 'right' : 'left'}
      dragSlot={dragSlot} onPick={onPick} onDragStart={(s) => setDragCode(s.code)} onDragEnd={() => setDragCode(null)} onDrop={onDropMove}
      onAddLocation={addLocation} onRemoveLocation={removeLocation} onRemoveBay={removeBay} />
  );

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-6">
      {modal && byCode[modal.code] && (
        <LocationModal slot={byCode[modal.code]} mode={modal.mode} onPlace={placePallet} onSaveEdit={saveEdit} onAdjust={adjustEaches} onEmpty={emptySlot} onClose={() => setModal(null)} />
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-xs text-slate-950 font-bold px-2 py-0.5 rounded animate-pulse">TELEMETRY ON</span>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Eagle View</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">Beverage Distribution · Spatial Warehouse Map &amp; Case / Each Stocking Matrix</p>
        </div>
        <button onClick={resetSim} className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg text-slate-300 transition"><RefreshCw size={14} /> Reset Simulation</button>
      </header>

      {/* Legend */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 my-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Visual Telemetry Rules</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {[
            { dot: 'bg-emerald-500', border: 'border-emerald-500/30', label: 'Green: Full (>80%)' },
            { dot: 'bg-amber-500',   border: 'border-amber-500/30',   label: 'Yellow: Mid / Attention' },
            { dot: 'bg-red-500',     border: 'border-red-500/30',     label: 'Red: Low Inventory' },
            { dot: 'bg-slate-800 border border-slate-700', border: 'border-slate-800', label: 'Black: Empty Location' },
            { dot: 'bg-blue-500',    border: 'border-blue-500', pulse: true, labelClass: 'font-semibold text-slate-200', label: 'Blue: Replenishing' },
          ].map(({ dot, border, label, pulse, labelClass = 'text-slate-300' }) => (
            <div key={label} className={`flex items-center gap-2 bg-slate-950 p-2 rounded-md border ${border} ${pulse ? 'animate-pulse' : ''}`}><span className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} /><span className={`text-[11px] ${labelClass}`}>{label}</span></div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed"><span className="text-cyan-400 font-bold">Build it:</span> Add Aisle → open an aisle to Add Bay → Add Location. <span className="text-cyan-400 font-bold">Click any location</span> for detail, pick/receive &amp; editing; click an empty one to add a pallet by SKU or item search. Drag a pallet onto an empty slot to move it, or onto the same SKU to top it up.</p>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        {[{ id: 'layout', icon: <Boxes size={16} />, label: 'Warehouse Layout' }, { id: 'ledger', icon: <BarChart3 size={16} />, label: 'Item Ledger' }].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 border-b-2 -mb-px ${activeTab === tab.id ? 'border-blue-500 text-blue-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{tab.icon} {tab.label}</button>
        ))}
        <span className="px-3 py-2 text-xs text-slate-600 self-center font-mono">Employee Login · Routes → next</span>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {activeTab === 'layout' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2"><Boxes className="text-cyan-400" size={18} /><h2 className="font-semibold text-slate-200">Warehouse Builder · Aisle / Bay / Location Map</h2></div>
                <button onClick={addAisle} className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md font-bold transition"><Plus size={11} /> Add Aisle</button>
              </div>

              <div className="space-y-4">
                {aisles.length === 0 && <p className="text-center text-slate-600 text-xs py-10 font-mono">No aisles yet — click “Add Aisle” to start building.</p>}
                {aisles.map((ai) => {
                  const a = ai.name;
                  const bayNames = Object.keys(layout[a] || {}).sort((x, y) => +x - +y);
                  const left = bayNames.filter((b) => (+b) % 2 === 0), right = bayNames.filter((b) => (+b) % 2 === 1);
                  const filled = (layout[a] ? Object.values(layout[a]).flat() : []);
                  return (
                    <div key={a} className="border border-slate-800 rounded-xl overflow-hidden">
                      <div className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-950/60">
                        <button onClick={() => toggleAisle(a)} className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200 hover:text-cyan-300 transition">
                          <MapPin size={12} className="text-cyan-400" /> AISLE {a}
                          <span className="text-[10px] font-normal text-slate-500">{filled.filter((s) => s.pallet).length}/{filled.length} filled · {bayNames.length} bays</span>
                          {collapsed[a] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
                        </button>
                        <div className="flex items-center gap-2">
                          <button onClick={() => addBay(a)} className="flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2 py-1 rounded-md font-bold transition"><Plus size={10} /> Add Bay</button>
                          {bayNames.length === 0 && <button onClick={() => removeAisle(a)} title="Remove empty aisle" className="text-slate-600 hover:text-red-400 text-sm">×</button>}
                        </div>
                      </div>
                      {!collapsed[a] && (
                        bayNames.length === 0 ? (
                          <div className="p-6 text-center bg-slate-900/40"><button onClick={() => addBay(a)} className="text-xs text-slate-500 hover:text-cyan-400 border border-dashed border-slate-700 hover:border-cyan-600 rounded-lg px-4 py-3 transition font-mono inline-flex items-center gap-2"><PlusCircle size={14} /> Add the first bay to aisle {a}</button></div>
                        ) : (
                          <div className="p-3 grid grid-cols-[1fr_2.75rem_1fr] gap-3 bg-slate-900/40">
                            <div className="space-y-3"><p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest text-center">left · even</p>{left.map((b) => renderBay(a, b))}</div>
                            <AisleLane aisle={a} />
                            <div className="space-y-3"><p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest text-center">right · odd</p>{right.map((b) => renderBay(a, b))}</div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2"><BarChart3 className="text-cyan-400" size={18} /><h2 className="font-semibold text-slate-200">Inventory Item Ledger</h2></div>
                <span className="text-[10px] font-mono text-slate-400">{sortedPallets.length} pallets</span>
              </div>
              <div className="relative mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search location, SKU, name, category…" className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <SortHead col="code" label="Location" /><SortHead col="sku" label="SKU" /><SortHead col="product" label="Product" /><SortHead col="cases" label="Cases" /><SortHead col="fill" label="Fill" /><th className="pb-3 pr-4 font-medium">Liquid</th><th className="pb-3 font-medium">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {sortedPallets.map((p) => {
                      const pc = fillPct(p), sc = splitCases(p);
                      return (
                        <tr key={p.code} onClick={() => setModal({ code: p.code, mode: 'detail' })} className="hover:bg-slate-800/30 transition cursor-pointer group">
                          <td className="py-3 pr-4 font-mono text-cyan-400">{p.code}{p.primary && <span className="ml-1 text-[8px] text-cyan-600">P</span>}</td>
                          <td className="py-3 pr-4 font-mono text-slate-400 group-hover:text-slate-300">{p.sku}</td>
                          <td className="py-3 pr-4 max-w-[180px]"><p className="text-slate-200 font-medium leading-tight line-clamp-1">{p.product}</p><p className="text-slate-500 text-[10px]">{p.category}</p></td>
                          <td className="py-3 pr-4 font-mono"><span className="text-slate-200">{fmt(sc.cases)}</span>{sc.loose ? <span className="text-slate-600"> +{sc.loose}</span> : null}</td>
                          <td className="py-3 pr-4"><div className="flex items-center gap-1.5"><div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pc}%`, backgroundColor: barColor(pc) }} /></div><span className="font-mono text-[10px] text-slate-400">{pc}%</span></div></td>
                          <td className="py-3 pr-4 font-mono text-[10px] text-cyan-300/80">{fmtVolume(totalMl(p))}</td>
                          <td className="py-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeStyle(pc)}`}>{slotStatus({ pallet: p }).label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {sortedPallets.length === 0 && <p className="text-center text-slate-600 text-xs py-8 font-mono">{searchTerm ? 'No pallets match your search.' : 'No pallets stored yet.'}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Cpu size={11} /> System Summary</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Total Slots', value: stats.total, color: 'text-slate-200' },
                { label: 'Occupied', value: stats.occupied, color: 'text-slate-200' },
                { label: 'Distinct SKUs', value: stats.skus, color: 'text-slate-200' },
                { label: 'Empty Primaries', value: stats.emptyPrimaries, color: 'text-amber-400' },
                { label: 'Inbound', value: stats.inbound, color: 'text-blue-400' },
                { label: 'Total Cases', value: fmt(stats.cases), color: 'text-emerald-400' },
                { label: 'Liquid On Hand', value: `${stats.liters.toFixed(1)} L`, color: 'text-cyan-300' },
              ].map((row) => (<div key={row.label} className="flex justify-between items-center text-xs"><span className="text-slate-400">{row.label}</span><span className={`font-mono font-bold ${row.color}`}>{row.value}</span></div>))}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1.5"><span className="text-slate-400">Primary Pick-Face Health</span><span className="font-mono text-slate-300 text-[10px]">{stats.health}%</span></div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stats.health}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Terminal size={11} /> Eagle View AI Terminal</h3>
            <p className="text-[10px] font-mono text-slate-600 mb-3 leading-relaxed">move &lt;src&gt; &lt;dst&gt; · pick / receive &lt;code&gt; &lt;n&gt;<br />fill · drain · restock · status · clear · help</p>
            <form onSubmit={handleTerminalSubmit} className="flex gap-2">
              <input value={terminalInput} onChange={(e) => setTerminalInput(e.target.value)} placeholder="enter command…" className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition" />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 rounded-md font-mono font-bold transition">RUN</button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3"><h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><ShieldAlert size={11} /> Live Stream Logs</h3>{logs.length > 0 && <button onClick={() => setLogs([])} className="text-[10px] text-slate-600 hover:text-slate-400 transition font-mono">clear</button>}</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.length === 0 && <p className="text-[10px] text-slate-600 font-mono">// log cleared</p>}
              {logs.map((log, i) => (<div key={i} className="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/60"><span className="text-slate-600">[{log.time}] </span><span className={`font-bold mr-1 ${log.type === 'warning' ? 'text-amber-400' : log.type === 'ai' ? 'text-purple-400' : log.type === 'user' ? 'text-cyan-400' : 'text-blue-400'}`}>{log.type.toUpperCase()}:</span><span className="text-slate-300">{log.message}</span></div>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
