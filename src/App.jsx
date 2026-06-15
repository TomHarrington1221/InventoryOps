import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw, Search, ShieldAlert, Cpu, Terminal,
  Boxes, BarChart3, Layers, Plus, Minus, Trash2, X,
  ChevronUp, ChevronDown, Pencil, Package, ArrowDown, MapPin,
  Wine, Martini, CupSoda, Droplet,
} from 'lucide-react';

// ── Warehouse dimensions ─────────────────────────────────────────────────────
//  Location code grammar:  aisle-bay-(level)(position)  →  "0-01-11"
//  Level 1 = primary floor / pick face.  Levels 2+ = reserve / overstock.
//  Odd bays line the RIGHT wall, even bays the LEFT wall, across a center aisle.

const AISLES         = 2;   // 0 … 1
const BAYS_PER_AISLE = 6;   // 1 … 6   (odd = right, even = left)
const LEVELS         = 3;   // 1 … 3   (1 = primary floor)
const POSITIONS      = 2;   // 1 … 2

// ── Product catalog (wine · spirits · canned cocktails) ──────────────────────
//  Units of measure:  Pallet → Cases → Eaches (bottles / cans).
//  volumePerEach drives the "liquid contents" telemetry.

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

// Seed placements keyed by location code.  { sku, cases, loose? } = pallet, { inbound } = empty + replenishment en route.
const SEED = {
  // ── Aisle 0 ──────────────────────────────────────────────
  '0-01-11': { sku: 'SKU-4501', cases: 56 },            // primary, full
  '0-01-12': { sku: 'SKU-4501', cases:  6, loose: 3 },  // primary, low  → drag reserve down to top up
  '0-01-21': { sku: 'SKU-4501', cases: 56 },            // reserve, full
  '0-02-11': { inbound: true },                          // empty primary, inbound (blue)
  '0-02-12': { sku: 'SKU-7725', cases:  5 },            // primary, low (tequila)
  '0-02-21': { sku: 'SKU-7725', cases: 60 },            // reserve, full
  '0-03-11': { sku: 'SKU-4533', cases: 40 },            // primary, attention (sparkling)
  '0-03-12': { sku: 'SKU-4533', cases: 84 },            // primary, full
  '0-03-21': { sku: 'SKU-4533', cases: 90 },            // reserve
  '0-04-21': { sku: 'SKU-7710', cases: 70 },            // reserve whisky, full  → drag down to empty 0-04-11
  '0-05-11': { sku: 'SKU-9120', cases: 55 },            // primary, ~55% (cans)
  '0-05-21': { sku: 'SKU-9120', cases: 100 },           // reserve, full
  // ── Aisle 1 ──────────────────────────────────────────────
  '1-01-11': { sku: 'SKU-7740', cases: 44 },            // gin
  '1-01-12': { sku: 'SKU-7740', cases:  2 },            // very low
  '1-02-11': { sku: 'SKU-7755', cases: 18 },            // vodka, mid
  '1-03-11': { sku: 'SKU-4520', cases: 48 },            // pinot grigio
  '1-03-21': { sku: 'SKU-4520', cases: 56 },            // reserve
  '1-04-11': { inbound: true },
  '1-05-11': { sku: 'SKU-9135', cases: 40 },            // paloma cans
};

// ── Catalog visuals (placeholder thumbnails) ─────────────────────────────────

const CATEGORY_VISUAL = {
  'Red Wine':        { Icon: Wine,    tint: 'from-rose-900/70 to-rose-950',       ring: 'border-rose-700/50',    text: 'text-rose-300'    },
  'White Wine':      { Icon: Wine,    tint: 'from-amber-700/50 to-amber-950',     ring: 'border-amber-600/50',   text: 'text-amber-200'   },
  'Sparkling Wine':  { Icon: Wine,    tint: 'from-yellow-600/50 to-amber-950',    ring: 'border-yellow-600/50',  text: 'text-yellow-200'  },
  'Whisky':          { Icon: Martini, tint: 'from-orange-800/60 to-amber-950',    ring: 'border-orange-700/50',  text: 'text-orange-200'  },
  'Tequila':         { Icon: Martini, tint: 'from-lime-800/50 to-emerald-950',    ring: 'border-lime-700/50',    text: 'text-lime-200'    },
  'Gin':             { Icon: Martini, tint: 'from-sky-800/50 to-slate-950',       ring: 'border-sky-700/50',     text: 'text-sky-200'     },
  'Vodka':           { Icon: Martini, tint: 'from-indigo-800/50 to-slate-950',    ring: 'border-indigo-700/50',  text: 'text-indigo-200'  },
  'Canned Cocktail': { Icon: CupSoda, tint: 'from-fuchsia-800/50 to-pink-950',    ring: 'border-fuchsia-700/50', text: 'text-fuchsia-200' },
};
const visualFor = (cat) => CATEGORY_VISUAL[cat] || { Icon: Droplet, tint: 'from-slate-800 to-slate-950', ring: 'border-slate-700', text: 'text-slate-300' };

// ── Units-of-measure helpers ─────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');
const fmt  = (n) => Math.round(n).toLocaleString();
const slotCode = (a, b, l, p) => `${a}-${pad2(b)}-${l}${p}`;
const plural = (u, n) => `${u}${n === 1 ? '' : 's'}`;

const maxEaches = (p) => p.casesPerPallet * p.eachesPerCase;
const fillPct   = (p) => { const m = maxEaches(p); return m ? Math.round((p.eaches / m) * 100) : 0; };
const splitCases = (p) => ({ cases: Math.floor(p.eaches / p.eachesPerCase), loose: p.eaches % p.eachesPerCase });
const totalMl   = (p) => (p.volumePerEach ? p.eaches * p.volumePerEach : 0);
const fmtVolume = (ml) => {
  if (!ml) return '—';
  if (ml >= 1000) return `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
  return `${fmt(ml)} mL`;
};

function makePallet(sku, eaches, image = '') {
  const m = PRODUCTS[sku];
  return {
    sku, product: m.product, category: m.category, unit: m.unit,
    eachesPerCase: m.eachesPerCase, casesPerPallet: m.casesPerPallet,
    volumePerEach: m.volumePerEach, volumeUnit: m.volumeUnit, image, eaches,
  };
}

function buildSlots() {
  const slots = [];
  for (let a = 0; a < AISLES; a++)
    for (let b = 1; b <= BAYS_PER_AISLE; b++)
      for (let l = 1; l <= LEVELS; l++)
        for (let p = 1; p <= POSITIONS; p++) {
          const code = slotCode(a, b, l, p);
          const seed = SEED[code];
          let pallet = null, inbound = false;
          if (seed?.inbound) inbound = true;
          else if (seed) {
            const m = PRODUCTS[seed.sku];
            pallet = makePallet(seed.sku, (seed.cases || 0) * m.eachesPerCase + (seed.loose || 0));
          }
          slots.push({ code, aisle: a, bay: b, level: l, position: p, primary: l === 1, pallet, inbound });
        }
  return slots;
}

function barColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 30) return '#f59e0b';
  if (pct > 0)   return '#ef4444';
  return '#1e293b';
}

// Visual telemetry for a single slot (Full / Attention / Low / Empty / Replenishing).
function slotStatus(slot) {
  if (!slot.pallet) {
    if (slot.inbound)
      return { empty: true, pct: 0, label: 'Replenishing',
        cardStyle: 'bg-black border-blue-500 text-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]' };
    return { empty: true, pct: 0, label: 'Empty', cardStyle: 'bg-slate-950 border-slate-800 text-slate-600' };
  }
  const pct = fillPct(slot.pallet);
  if (slot.inbound && pct < 30)
    return { pct, label: 'Critical + Pending', cardStyle: 'bg-black border-blue-400 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]' };
  if (pct >= 80) return { pct, label: 'Full',             cardStyle: 'bg-emerald-950/80 border-emerald-500 text-emerald-300' };
  if (pct >= 30) return { pct, label: 'Attention Needed', cardStyle: 'bg-amber-950/80 border-amber-500 text-amber-300' };
  return           { pct, label: 'Low Stock',             cardStyle: 'bg-red-950/80 border-red-500 text-red-300' };
}

function badgeStyle(pct) {
  if (pct >= 80)  return 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50';
  if (pct >= 30)  return 'bg-amber-900/40 text-amber-400 border border-amber-500/50';
  return 'bg-red-900/40 text-red-400 border border-red-500/50';
}

// Movement: drop allowed iff target empty (move) or same SKU (top-up / merge); never displaces a different product.
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
  const o = { 1: [], 2: [], 3: [] };
  baySlots.forEach((s) => { (o[s.level] ||= []).push(s); });
  Object.values(o).forEach((arr) => arr.sort((a, b) => a.position - b.position));
  return o;
}

// ── Form primitives ──────────────────────────────────────────────────────────

function Field({ label, value, onChange, disabled = false, mono = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
        className={`w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200
          placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition
          disabled:opacity-40 disabled:cursor-not-allowed ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="number" value={value} min={min} max={max}
        onChange={(e) => { const n = Number(e.target.value); onChange(max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n)); }}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 transition"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <select
        value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 transition disabled:opacity-40"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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

function ProductThumb({ pallet, className = '', iconSize = 40 }) {
  const v = visualFor(pallet.category);
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [pallet.image]);
  if (pallet.image && !err)
    return <img src={pallet.image} alt={pallet.product} onError={() => setErr(true)} className={`object-cover ${className}`} />;
  const Icon = v.Icon;
  return (
    <div className={`bg-gradient-to-b ${v.tint} border ${v.ring} flex items-center justify-center ${className}`}>
      <Icon size={iconSize} className={`${v.text} opacity-90`} />
    </div>
  );
}

// ── Location detail / edit / place modal ─────────────────────────────────────

function LocationModal({ slot, mode, emptyPrimaries, onPlace, onSaveEdit, onAdjust, onEmpty, onClose }) {
  const placing = mode === 'place' || !slot.pallet;
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(null);
  // placement state
  const [pSku, setPSku]       = useState(SKU_LIST[0]);
  const [pCode, setPCode]     = useState(slot.code);
  const [pCases, setPCases]   = useState(0);
  const [pLoose, setPLoose]   = useState(0);
  const [pInbound, setPInbound] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const startEdit = () => {
    const p = slot.pallet; const { cases, loose } = splitCases(p);
    setForm({
      product: p.product, category: p.category, sku: p.sku, unit: p.unit,
      eachesPerCase: p.eachesPerCase, casesPerPallet: p.casesPerPallet,
      volumePerEach: p.volumePerEach, volumeUnit: p.volumeUnit, image: p.image || '',
      cases, loose, inbound: slot.inbound,
    });
    setEditing(true);
  };
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── Placement form ─────────────────────────────────────────────────────────
  if (placing) {
    const meta = PRODUCTS[pSku];
    const eaches = pCases * meta.eachesPerCase + pLoose;
    const cap = meta.casesPerPallet * meta.eachesPerCase;
    return (
      <Shell title="Place Pallet" icon={<Package size={16} className="text-cyan-400" />} onClose={onClose}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Primary Location" value={pCode} onChange={setPCode} options={emptyPrimaries.map((c) => ({ value: c, label: c }))} />
            <Select label="Product (SKU)" value={pSku} onChange={setPSku} options={SKU_LIST.map((s) => ({ value: s, label: `${s} · ${PRODUCTS[s].product}` }))} />
          </div>
          <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <ProductThumb pallet={makePallet(pSku, eaches)} className="w-12 h-16 rounded-md flex-shrink-0" iconSize={24} />
            <div className="text-[11px] text-slate-300 leading-relaxed">
              <p className="font-bold text-slate-100">{meta.product}</p>
              <p className="text-slate-500">{meta.category} · {meta.eachesPerCase} {plural(meta.unit, 2).toLowerCase()}/case · {meta.volumePerEach} {meta.volumeUnit}/{meta.unit.toLowerCase()}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Cases" value={pCases} min={0} max={meta.casesPerPallet} onChange={setPCases} />
            <NumberField label={`Loose ${plural(meta.unit, 2)}`} value={pLoose} min={0} max={meta.eachesPerCase - 1} onChange={setPLoose} />
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Liquid</label>
              <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-cyan-300">{fmtVolume(eaches * meta.volumePerEach)}</div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5">
            <Toggle label="Replenishment In Transit" checked={pInbound} onChange={setPInbound} />
          </div>
          {emptyPrimaries.length === 0 && <p className="text-[10px] text-amber-400 font-mono">No empty primary slots available — free one up first.</p>}
        </div>
        <Footer onClose={onClose}
          confirmLabel="Place Pallet"
          confirmDisabled={!pCode || eaches <= 0 || eaches > cap}
          onConfirm={() => onPlace(pCode, pSku, pCases, pLoose, pInbound)} />
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

  return (
    <Shell
      title={
        <span className="flex items-center gap-2 font-mono">
          {slot.code}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${slot.primary ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'}`}>
            {slot.primary ? 'PRIMARY' : 'RESERVE'}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeStyle(pct)}`}>{st.label}</span>
        </span>
      }
      icon={<MapPin size={16} className="text-cyan-400" />}
      onClose={onClose}
    >
      {/* Identity */}
      <div className="flex gap-4">
        <ProductThumb pallet={p} className="w-24 h-32 rounded-lg flex-shrink-0 shadow-lg" iconSize={44} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-100 leading-tight">{p.product}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-400 font-mono">
            <span>{p.sku}</span><span className={v.text}>{p.category}</span>
            <span>{p.eachesPerCase} {plural(p.unit, 2).toLowerCase()}/case</span>
            <span>{p.volumePerEach} {p.volumeUnit}/{p.unit.toLowerCase()}</span>
          </div>
          {/* Fill bar */}
          <div className="mt-3">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor(pct) }} />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>{cases} / {p.casesPerPallet} cases</span><span>{pct}% full</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Metric big={fmt(cases)} label="cases" sub={loose ? `+${loose} loose ${plural(p.unit, loose).toLowerCase()}` : 'full cases'} />
        <Metric big={fmt(p.eaches)} label={plural(p.unit, 2).toLowerCase()} sub={`${cases}×${p.eachesPerCase}${loose ? ` +${loose}` : ''}`} />
        <Metric big={fmtVolume(ml)} label="liquid contents" sub={`${p.volumePerEach} ${p.volumeUnit} each`} accent />
        <Metric big={`${pct}%`} label="pallet fill" sub={`max ${fmt(maxEaches(p))} ${plural(p.unit, 2).toLowerCase()}`} />
      </div>

      {/* Pick / receive */}
      {!editing && (
        <div className="mt-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pick &amp; Receive</p>
          <div className="grid grid-cols-4 gap-2">
            <PickBtn label={`−1 Case`}  tone="pick"    onClick={() => onAdjust(slot.code, -p.eachesPerCase)} />
            <PickBtn label={`−1 ${p.unit}`} tone="pick" onClick={() => onAdjust(slot.code, -1)} />
            <PickBtn label={`+1 ${p.unit}`} tone="recv" onClick={() => onAdjust(slot.code, +1)} />
            <PickBtn label={`+1 Case`}  tone="recv"    onClick={() => onAdjust(slot.code, +p.eachesPerCase)} />
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-4 border-t border-slate-800 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="SKU" value={form.sku} onChange={(sku) => { const m = PRODUCTS[sku]; setForm((f) => ({ ...f, sku, product: m.product, category: m.category, unit: m.unit, eachesPerCase: m.eachesPerCase, casesPerPallet: m.casesPerPallet, volumePerEach: m.volumePerEach, volumeUnit: m.volumeUnit })); }} options={SKU_LIST.map((s) => ({ value: s, label: s }))} />
            <Field label="Category" value={form.category} onChange={(x) => setF('category', x)} />
          </div>
          <Field label="Product Name" value={form.product} onChange={(x) => setF('product', x)} />
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Cases" value={form.cases} min={0} max={form.casesPerPallet} onChange={(x) => setF('cases', x)} />
            <NumberField label={`Loose ${plural(form.unit, 2)}`} value={form.loose} min={0} max={form.eachesPerCase - 1} onChange={(x) => setF('loose', x)} />
            <NumberField label="Cases / Pallet" value={form.casesPerPallet} min={1} onChange={(x) => setF('casesPerPallet', x)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label={`${plural(form.unit, 2)} / Case`} value={form.eachesPerCase} min={1} onChange={(x) => setF('eachesPerCase', x)} />
            <NumberField label={`Volume / ${form.unit} (${form.volumeUnit})`} value={form.volumePerEach} min={0} onChange={(x) => setF('volumePerEach', x)} />
            <Field label="Volume Unit" value={form.volumeUnit} onChange={(x) => setF('volumeUnit', x)} mono />
          </div>
          <Field label="Image URL (optional)" value={form.image} onChange={(x) => setF('image', x)} placeholder="https://… (leave blank for placeholder)" mono />
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5">
            <Toggle label="Replenishment In Transit" checked={form.inbound} onChange={(x) => setF('inbound', x)} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
        {editing ? (
          <>
            <button onClick={() => onEmpty(slot.code)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition">
              <Trash2 size={12} /> Empty Slot
            </button>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
              <button onClick={() => { onSaveEdit(slot.code, form); setEditing(false); }} className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition">Save Changes</button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => onEmpty(slot.code)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition">
              <Trash2 size={12} /> Empty Slot
            </button>
            <div className="flex gap-2">
              <button onClick={startEdit} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition">
                <Pencil size={12} /> Edit Details
              </button>
              <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition">Done</button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

// Modal chrome + small bits
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
function Footer({ onClose, onConfirm, confirmLabel, confirmDisabled }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
      <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
      <button onClick={onConfirm} disabled={confirmDisabled} className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition">{confirmLabel}</button>
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
function PickBtn({ label, tone, onClick }) {
  const isRecv = tone === 'recv';
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-1 text-[11px] font-bold py-2 rounded-lg border transition
        ${isRecv ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'
                 : 'bg-red-950/40 border-red-800/50 text-red-300 hover:bg-red-900/40'}`}>
      {isRecv ? <Plus size={11} /> : <Minus size={11} />}{label.replace(/^[−+]1 /, '1 ')}
    </button>
  );
}

// ── Single location cell (draggable pallet + drop target) ─────────────────────

function SlotCell({ slot, dragSlot, onPick, onDragStart, onDragEnd, onDrop }) {
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
    <div
      draggable={has}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', slot.code); onDragStart(slot); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), slot.code); }}
      onClick={() => onPick(slot)}
      title={slot.code}
      className={`relative rounded-lg border p-2 h-[70px] flex flex-col justify-between select-none transition hover:brightness-110
        ${st.cardStyle} ${ring} ${has ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] font-bold tracking-wider opacity-80">{loc}</span>
        {slot.primary && <span className="text-[7px] font-bold px-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 leading-tight">PRIMARY</span>}
      </div>
      {has ? (
        <>
          <div className="flex items-center gap-1 leading-tight min-w-0">
            {Icon && <Icon size={12} className={`${v.text} flex-shrink-0`} />}
            <div className="min-w-0">
              <p className="text-[9px] font-bold line-clamp-1">{slot.pallet.product}</p>
              <p className="text-[8px] font-mono opacity-60">{slot.pallet.sku}</p>
            </div>
          </div>
          <div>
            <div className="h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${st.pct}%`, backgroundColor: barColor(st.pct) }} />
            </div>
            <div className="flex justify-between items-center mt-0.5">
              <span className="text-[8px] font-mono opacity-70">{fmt(cases)} cs</span>
              <span className="text-[8px] font-mono font-bold">{st.pct}%</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] font-mono tracking-widest">{slot.inbound ? 'INBOUND' : 'EMPTY'}</span>
        </div>
      )}
    </div>
  );
}

// ── Bay rack + aisle lane ─────────────────────────────────────────────────────

function BayRack({ code2, levels, side, dragSlot, onPick, onDragStart, onDragEnd, onDrop }) {
  const all = [levels[1], levels[2], levels[3]].flat();
  const occ = all.filter((s) => s.pallet).length;
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] font-bold text-slate-300 flex items-center gap-1"><Layers size={10} className="text-slate-500" /> BAY {code2}</span>
        <span className="text-[8px] font-mono text-slate-500">{side} · {occ}/{all.length}</span>
      </div>
      <div className="space-y-1">
        {[3, 2, 1].map((l) => (
          <div key={l} className="flex items-stretch gap-1">
            <div className={`w-5 flex items-center justify-center rounded text-[8px] font-mono font-bold ${l === 1 ? 'bg-cyan-900/40 text-cyan-300' : 'bg-slate-800/60 text-slate-500'}`}>L{l}</div>
            <div className="grid grid-cols-2 gap-1 flex-1">
              {(levels[l] || []).map((s) => (
                <SlotCell key={s.code} slot={s} dragSlot={dragSlot} onPick={onPick} onDragStart={onDragStart} onDragEnd={onDragEnd} onDrop={onDrop} />
              ))}
            </div>
          </div>
        ))}
      </div>
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

export default function NexusFlowOS() {
  const [activeTab, setActiveTab]         = useState('layout');
  const [slots, setSlots]                 = useState(buildSlots);
  const [searchTerm, setSearchTerm]       = useState('');
  const [logs, setLogs]                   = useState([
    { time: '13:02:11', type: 'system', message: 'Spatial telemetry online. 2 primary slots flagged for autonomous replenishment.' },
    { time: '12:54:10', type: 'ai',     message: 'AI demand models recalculated using regional logistics telemetry.' },
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [modal, setModal]                 = useState(null); // { code, mode }
  const [collapsed, setCollapsed]         = useState({});
  const [dragCode, setDragCode]           = useState(null);
  const [sortKey, setSortKey]             = useState('code');
  const [sortDir, setSortDir]             = useState('asc');

  const addLog = useCallback((type, message) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), type, message }, ...prev]);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const byCode = useMemo(() => { const m = {}; slots.forEach((s) => { m[s.code] = s; }); return m; }, [slots]);
  const layout = useMemo(() => {
    const m = {};
    slots.forEach((s) => { (m[s.aisle] ??= {}); (m[s.aisle][s.bay] ??= []).push(s); });
    return m;
  }, [slots]);
  const emptyPrimaries = useMemo(() => slots.filter((s) => s.primary && !s.pallet).map((s) => s.code).sort(), [slots]);

  const stats = useMemo(() => {
    const occupied  = slots.filter((s) => s.pallet);
    const primaries = slots.filter((s) => s.primary);
    const stocked   = primaries.filter((s) => s.pallet && fillPct(s.pallet) >= 30);
    const totalCases = occupied.reduce((sum, s) => sum + splitCases(s.pallet).cases, 0);
    const totalMlSum = occupied.reduce((sum, s) => sum + totalMl(s.pallet), 0);
    return {
      total:          slots.length,
      occupied:       occupied.length,
      skus:           new Set(occupied.map((s) => s.pallet.sku)).size,
      emptyPrimaries: primaries.filter((s) => !s.pallet).length,
      inbound:        slots.filter((s) => s.inbound).length,
      cases:          totalCases,
      liters:         totalMlSum / 1000,
      health:         primaries.length ? Math.round((stocked.length / primaries.length) * 100) : 0,
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
      if (sortKey === 'fill')  { av = fillPct(a); bv = fillPct(b); }
      if (sortKey === 'cases') { av = a.eaches;   bv = b.eaches;   }
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return rows;
  }, [filteredPallets, sortKey, sortDir]);

  // ── Pallet movement ──────────────────────────────────────────────────────────
  const movePallet = useCallback((srcCode, tgtCode) => {
    const src = byCode[srcCode], tgt = byCode[tgtCode];
    if (!src || !tgt) return;
    const res = classifyDrop(src, tgt);
    if (!res.ok) { addLog('warning', `Move blocked — ${tgtCode} ${res.reason}.`); return; }
    if (res.mode === 'merge') {
      const space = maxEaches(tgt.pallet) - tgt.pallet.eaches;
      const moved = Math.min(space, src.pallet.eaches);
      const left  = src.pallet.eaches - moved;
      setSlots((prev) => prev.map((s) => {
        if (s.code === tgtCode) return { ...s, pallet: { ...s.pallet, eaches: s.pallet.eaches + moved }, inbound: false };
        if (s.code === srcCode) return { ...s, pallet: left > 0 ? { ...s.pallet, eaches: left } : null };
        return s;
      }));
      addLog('system', `Replenished ${tgtCode} with ${fmt(moved)} ${plural(src.pallet.unit, moved).toLowerCase()} of ${src.pallet.sku} from ${srcCode}.`);
    } else {
      setSlots((prev) => prev.map((s) => {
        if (s.code === tgtCode) return { ...s, pallet: src.pallet, inbound: false };
        if (s.code === srcCode) return { ...s, pallet: null };
        return s;
      }));
      addLog('system', `Moved ${src.pallet.sku} pallet ${srcCode} → ${tgtCode}.`);
    }
  }, [byCode, addLog]);

  const onDropMove = useCallback((srcCode, tgtCode) => { setDragCode(null); if (srcCode && srcCode !== tgtCode) movePallet(srcCode, tgtCode); }, [movePallet]);

  // ── Pick / receive / edit / place ────────────────────────────────────────────
  const adjustEaches = useCallback((code, delta) => {
    const s = byCode[code]; if (!s?.pallet) return;
    const max = maxEaches(s.pallet);
    const next = Math.max(0, Math.min(max, s.pallet.eaches + delta));
    if (next === s.pallet.eaches) { addLog('warning', `${code} ${delta > 0 ? 'at full pallet capacity' : 'already empty'} — no change.`); return; }
    setSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, eaches: next }, inbound: next > 0 ? false : x.inbound } : x));
    const qty = Math.abs(delta), isCase = qty === s.pallet.eachesPerCase;
    const what = isCase ? '1 case' : `${qty} ${plural(s.pallet.unit, qty).toLowerCase()}`;
    addLog('system', `${delta > 0 ? 'Received' : 'Picked'} ${what} ${delta > 0 ? 'into' : 'from'} ${code} — now ${splitCases({ ...s.pallet, eaches: next }).cases} cs / ${fmt(next)} ${plural(s.pallet.unit, next).toLowerCase()}.`);
  }, [byCode, addLog]);

  const saveEdit = useCallback((code, form) => {
    const eaches = Math.min(form.cases * form.eachesPerCase + form.loose, form.casesPerPallet * form.eachesPerCase);
    setSlots((prev) => prev.map((s) => s.code === code ? {
      ...s, inbound: form.inbound,
      pallet: { sku: form.sku, product: form.product, category: form.category, unit: form.unit, eachesPerCase: form.eachesPerCase, casesPerPallet: form.casesPerPallet, volumePerEach: form.volumePerEach, volumeUnit: form.volumeUnit, image: form.image, eaches },
    } : s));
    addLog('system', `${code} updated — ${form.sku}, ${form.cases} cs.`);
  }, [addLog]);

  const placePallet = useCallback((code, sku, cases, loose, inbound) => {
    const m = PRODUCTS[sku];
    const eaches = Math.min(cases * m.eachesPerCase + loose, m.casesPerPallet * m.eachesPerCase);
    setSlots((prev) => prev.map((s) => s.code === code ? { ...s, inbound, pallet: makePallet(sku, eaches) } : s));
    addLog('system', `Placed ${sku} (${m.product}) at ${code} — ${cases} cs.`);
    setModal(null);
  }, [addLog]);

  const emptySlot = useCallback((code) => {
    setSlots((prev) => prev.map((s) => s.code === code ? { ...s, pallet: null } : s));
    addLog('warning', `${code} emptied — pallet removed.`);
    setModal(null);
  }, [addLog]);

  const onPick = useCallback((slot) => {
    if (slot.pallet)       setModal({ code: slot.code, mode: 'detail' });
    else if (slot.primary) setModal({ code: slot.code, mode: 'place' });
    else addLog('warning', `${slot.code} is a reserve slot — place new product in an empty primary, or drag an existing pallet here.`);
  }, [addLog]);

  // ── Terminal ─────────────────────────────────────────────────────────────────
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    const raw = terminalInput.trim();
    if (!raw) return;
    setTerminalInput('');
    const cmd = raw.toLowerCase();
    const now = new Date().toLocaleTimeString();
    const parts = raw.split(/\s+/);
    let response = '';

    if (cmd === 'clear') { setLogs([]); return; }
    if (cmd === 'help') {
      response = 'Commands: move <src> <dst> · pick <code> <n> · receive <code> <n> · fill <code> · drain <code> · restock · status · clear · help';
    } else if (cmd === 'status') {
      response = `Slots ${stats.total} | Occupied ${stats.occupied} | Empty primaries ${stats.emptyPrimaries} | Inbound ${stats.inbound} | Cases ${fmt(stats.cases)} | Liquid ${stats.liters.toFixed(1)} L`;
    } else if (cmd.startsWith('move ')) {
      const [, a, b] = parts;
      if (byCode[a] && byCode[b]) { movePallet(a, b); response = `move ${a} → ${b} processed.`; }
      else response = 'Unknown location(s). e.g. "move 0-01-21 0-01-11".';
    } else if (cmd.startsWith('pick ') || cmd.startsWith('receive ')) {
      const code = parts[1], n = parseInt(parts[2], 10);
      if (byCode[code]?.pallet && n > 0) { adjustEaches(code, cmd.startsWith('pick') ? -n : n); response = `${parts[0]} ${n} @ ${code} processed.`; }
      else response = `Usage: ${parts[0]} <code> <n> (slot must hold a pallet).`;
    } else if (cmd.startsWith('fill ')) {
      const code = parts[1], s = byCode[code];
      if (s?.pallet) { setSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, eaches: Math.floor(maxEaches(x.pallet) * 0.9) }, inbound: false } : x)); response = `${code} filled to 90%.`; }
      else response = s ? `${code} is empty — nothing to fill.` : `"${code}" not found.`;
    } else if (cmd.startsWith('drain ')) {
      const code = parts[1], s = byCode[code];
      if (s?.pallet) { setSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, eaches: 0 } } : x)); response = `${code} drained to 0.`; }
      else response = s ? `${code} already empty.` : `"${code}" not found.`;
    } else if (cmd === 'restock') {
      setSlots((prev) => prev.map((x) => (x.pallet && fillPct(x.pallet) < 30) ? { ...x, pallet: { ...x.pallet, eaches: Math.floor(maxEaches(x.pallet) * 0.85) }, inbound: false } : x));
      response = 'All low pallets restocked to 85%.';
    } else {
      response = `Unknown command "${raw}". Type "help".`;
    }

    setLogs((prev) => [{ time: now, type: 'ai', message: response }, { time: now, type: 'user', message: `> ${raw}` }, ...prev]);
  };

  // ── Sorting ────────────────────────────────────────────────────────────────
  const handleSort = (key) => { if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('asc'); } };
  const SortHead = ({ col, label }) => (
    <th onClick={() => handleSort(col)} className="pb-3 pr-4 font-medium cursor-pointer select-none hover:text-slate-200 transition group">
      <span className="flex items-center gap-1">{label}
        <span className="text-slate-700 group-hover:text-slate-400 transition">
          {sortKey === col ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ChevronUp size={10} className="opacity-0 group-hover:opacity-40" />}
        </span>
      </span>
    </th>
  );

  const dragSlot = dragCode ? byCode[dragCode] : null;
  const toggleAisle = (a) => setCollapsed((c) => ({ ...c, [a]: !c[a] }));
  const resetSim = () => { setSlots(buildSlots()); setSearchTerm(''); setDragCode(null); setModal(null); addLog('system', 'Simulation reset to seed layout.'); };

  const renderBay = (a, b, side) => (
    <BayRack key={`${a}-${b}`} code2={pad2(b)} levels={groupLevels(layout[a]?.[b] || [])} side={side}
      dragSlot={dragSlot} onPick={onPick} onDragStart={(s) => setDragCode(s.code)} onDragEnd={() => setDragCode(null)} onDrop={onDropMove} />
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-6">

      {modal && byCode[modal.code] && (
        <LocationModal
          slot={byCode[modal.code]} mode={modal.mode} emptyPrimaries={emptyPrimaries}
          onPlace={placePallet} onSaveEdit={saveEdit} onAdjust={adjustEaches} onEmpty={emptySlot} onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-xs text-slate-950 font-bold px-2 py-0.5 rounded animate-pulse">TELEMETRY ON</span>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">NexusFlow OS</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">Beverage Distribution · Spatial Layout &amp; Case / Each Stocking Matrix</p>
        </div>
        <button onClick={resetSim} className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg text-slate-300 transition">
          <RefreshCw size={14} /> Reset Simulation
        </button>
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
            <div key={label} className={`flex items-center gap-2 bg-slate-950 p-2 rounded-md border ${border} ${pulse ? 'animate-pulse' : ''}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} />
              <span className={`text-[11px] ${labelClass}`}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
          <span className="text-cyan-400 font-bold">Click any location</span> for full detail — cases, bottles/cans, liquid contents, editing &amp; pick/receive.
          Drag a pallet onto an empty slot to move it, or onto the <span className="text-slate-300">same SKU</span> to top it up. New products go in an empty <span className="text-cyan-400 font-bold">PRIMARY</span> (floor) slot.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        {[{ id: 'layout', icon: <Boxes size={16} />, label: 'Spatial Warehouse Layout' }, { id: 'ledger', icon: <BarChart3 size={16} />, label: 'Item Ledger' }].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 border-b-2 -mb-px ${activeTab === tab.id ? 'border-blue-500 text-blue-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Spatial layout */}
          {activeTab === 'layout' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2"><Boxes className="text-cyan-400" size={18} /><h2 className="font-semibold text-slate-200">AI Floorplan · Aisle / Bay / Location Map</h2></div>
                <button onClick={() => setModal({ code: emptyPrimaries[0], mode: 'place' })} disabled={emptyPrimaries.length === 0}
                  className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-2.5 py-1 rounded-md font-bold transition">
                  <Plus size={11} /> Place Pallet
                </button>
              </div>

              <div className="space-y-4">
                {[...Array(AISLES).keys()].map((a) => (
                  <div key={a} className="border border-slate-800 rounded-xl overflow-hidden">
                    <button onClick={() => toggleAisle(a)} className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-950/60 hover:bg-slate-900 transition">
                      <span className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200">
                        <MapPin size={12} className="text-cyan-400" /> AISLE {a}
                        <span className="text-[10px] font-normal text-slate-500">{slots.filter((s) => s.aisle === a && s.pallet).length}/{slots.filter((s) => s.aisle === a).length} slots filled</span>
                      </span>
                      {collapsed[a] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
                    </button>
                    {!collapsed[a] && (
                      <div className="p-3 grid grid-cols-[1fr_2.75rem_1fr] gap-3 bg-slate-900/40">
                        <div className="space-y-3">
                          <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest text-center">left · even</p>
                          {[2, 4, 6].map((b) => renderBay(a, b, 'L'))}
                        </div>
                        <AisleLane aisle={a} />
                        <div className="space-y-3">
                          <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest text-center">right · odd</p>
                          {[1, 3, 5].map((b) => renderBay(a, b, 'R'))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Item ledger */}
          {activeTab === 'ledger' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2"><BarChart3 className="text-cyan-400" size={18} /><h2 className="font-semibold text-slate-200">Inventory Item Ledger</h2></div>
                <span className="text-[10px] font-mono text-slate-400">{sortedPallets.length} pallets</span>
              </div>
              <div className="relative mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search location, SKU, name, category…"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                      <SortHead col="code" label="Location" /><SortHead col="sku" label="SKU" /><SortHead col="product" label="Product" />
                      <SortHead col="cases" label="Cases" /><SortHead col="fill" label="Fill" /><th className="pb-3 pr-4 font-medium">Liquid</th><th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {sortedPallets.map((p) => {
                      const pct = fillPct(p); const { cases, loose } = splitCases(p);
                      return (
                        <tr key={p.code} onClick={() => setModal({ code: p.code, mode: 'detail' })} className="hover:bg-slate-800/30 transition cursor-pointer group">
                          <td className="py-3 pr-4 font-mono text-cyan-400">{p.code}{p.primary && <span className="ml-1 text-[8px] text-cyan-600">P</span>}</td>
                          <td className="py-3 pr-4 font-mono text-slate-400 group-hover:text-slate-300">{p.sku}</td>
                          <td className="py-3 pr-4 max-w-[180px]"><p className="text-slate-200 font-medium leading-tight line-clamp-1">{p.product}</p><p className="text-slate-500 text-[10px]">{p.category}</p></td>
                          <td className="py-3 pr-4 font-mono"><span className="text-slate-200">{fmt(cases)}</span>{loose ? <span className="text-slate-600"> +{loose}</span> : null}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor(pct) }} /></div>
                              <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono text-[10px] text-cyan-300/80">{fmtVolume(totalMl(p))}</td>
                          <td className="py-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeStyle(pct)}`}>{slotStatus({ pallet: p }).label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {sortedPallets.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-8 font-mono">{searchTerm ? 'No pallets match your search.' : 'No pallets stored. Place one from the layout view.'}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* System summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Cpu size={11} /> System Summary</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Total Slots',     value: stats.total,                 color: 'text-slate-200'   },
                { label: 'Occupied',        value: stats.occupied,              color: 'text-slate-200'   },
                { label: 'Distinct SKUs',   value: stats.skus,                  color: 'text-slate-200'   },
                { label: 'Empty Primaries', value: stats.emptyPrimaries,        color: 'text-amber-400'   },
                { label: 'Inbound',         value: stats.inbound,               color: 'text-blue-400'    },
                { label: 'Total Cases',     value: fmt(stats.cases),            color: 'text-emerald-400' },
                { label: 'Liquid On Hand',  value: `${stats.liters.toFixed(1)} L`, color: 'text-cyan-300' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center text-xs"><span className="text-slate-400">{row.label}</span><span className={`font-mono font-bold ${row.color}`}>{row.value}</span></div>
              ))}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1.5"><span className="text-slate-400">Primary Pick-Face Health</span><span className="font-mono text-slate-300 text-[10px]">{stats.health}%</span></div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stats.health}%` }} /></div>
              </div>
            </div>
          </div>

          {/* AI Terminal */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Terminal size={11} /> NexusFlow AI Terminal</h3>
            <p className="text-[10px] font-mono text-slate-600 mb-3 leading-relaxed">move &lt;src&gt; &lt;dst&gt; · pick / receive &lt;code&gt; &lt;n&gt;<br />fill · drain · restock · status · clear · help</p>
            <form onSubmit={handleTerminalSubmit} className="flex gap-2">
              <input value={terminalInput} onChange={(e) => setTerminalInput(e.target.value)} placeholder="enter command…"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition" />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 rounded-md font-mono font-bold transition">RUN</button>
            </form>
          </div>

          {/* Live logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><ShieldAlert size={11} /> Live Stream Logs</h3>
              {logs.length > 0 && <button onClick={() => setLogs([])} className="text-[10px] text-slate-600 hover:text-slate-400 transition font-mono">clear</button>}
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.length === 0 && <p className="text-[10px] text-slate-600 font-mono">// log cleared</p>}
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-slate-600">[{log.time}] </span>
                  <span className={`font-bold mr-1 ${log.type === 'warning' ? 'text-amber-400' : log.type === 'ai' ? 'text-purple-400' : log.type === 'user' ? 'text-cyan-400' : 'text-blue-400'}`}>{log.type.toUpperCase()}:</span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
