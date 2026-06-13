import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw, Search, ShieldAlert, Cpu, Terminal,
  Boxes, BarChart3, Layers, Plus, Trash2, X,
  ChevronUp, ChevronDown, Pencil, Package, ArrowDown, MapPin,
} from 'lucide-react';

// ── Warehouse dimensions ─────────────────────────────────────────────────────
//  Location code grammar:  aisle-bay-(level)(position)  →  "0-01-11"
//  Level 1 = primary floor / pick face.  Levels 2+ = reserve / overstock.
//  Odd bays line the RIGHT wall, even bays the LEFT wall, across a center aisle.

const AISLES         = 2;   // 0 … 1
const BAYS_PER_AISLE = 6;   // 1 … 6   (odd = right, even = left)
const LEVELS         = 3;   // 1 … 3   (1 = primary floor)
const POSITIONS      = 2;   // 1 … 2

// ── Product catalog ──────────────────────────────────────────────────────────

const PRODUCTS = {
  'SKU-8821': { product: 'Lithium-Ion Battery Pack v4',   category: 'Energy Storage', maxQty: 1500 },
  'SKU-4091': { product: 'Micro-Controller Unit (MCU-X)', category: 'Semiconductors', maxQty: 1000 },
  'SKU-1102': { product: 'Reinforced Aluminum Chassis',   category: 'Structural',     maxQty: 1000 },
  'SKU-7749': { product: 'High-Tensile Copper Wiring',    category: 'Cabling',        maxQty: 1200 },
  'SKU-5561': { product: 'Optoelectronic Sensor Array',   category: 'Sensors',        maxQty:  800 },
};
const SKU_LIST = Object.keys(PRODUCTS);

// Seed placements keyed by location code.  { sku, qty } = pallet, { inbound } = empty + replenishment en route.
const SEED = {
  // ── Aisle 0 ──────────────────────────────────────────────
  '0-01-11': { sku: 'SKU-8821', qty: 1500 },  // primary, full
  '0-01-12': { sku: 'SKU-8821', qty:  180 },  // primary, low  → drag reserve down to top up
  '0-01-21': { sku: 'SKU-8821', qty: 1500 },  // reserve, full
  '0-02-11': { inbound: true },               // empty primary, inbound (blue)
  '0-02-12': { sku: 'SKU-4091', qty:  110 },  // primary, low
  '0-02-21': { sku: 'SKU-4091', qty: 1000 },  // reserve, full
  '0-03-11': { sku: 'SKU-1102', qty:  450 },  // primary, attention
  '0-03-12': { sku: 'SKU-1102', qty:  950 },  // primary, full
  '0-03-21': { sku: 'SKU-1102', qty: 1000 },  // reserve
  '0-04-21': { sku: 'SKU-7749', qty: 1200 },  // reserve, full  → drag down to empty primary 0-04-11
  '0-05-11': { sku: 'SKU-5561', qty:  600 },  // primary, ~75%
  '0-05-21': { sku: 'SKU-5561', qty:  800 },  // reserve, full
  // ── Aisle 1 ──────────────────────────────────────────────
  '1-01-11': { sku: 'SKU-4091', qty:  920 },
  '1-01-12': { sku: 'SKU-4091', qty:   60 },  // very low
  '1-02-11': { sku: 'SKU-7749', qty:  300 },
  '1-03-11': { sku: 'SKU-8821', qty: 1200 },
  '1-03-21': { sku: 'SKU-8821', qty: 1500 },
  '1-04-11': { inbound: true },
  '1-05-11': { sku: 'SKU-5561', qty:  740 },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');
const fmt  = (n) => n.toLocaleString();
const slotCode = (a, b, l, p) => `${a}-${pad2(b)}-${l}${p}`;

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
            const meta = PRODUCTS[seed.sku];
            pallet = { sku: seed.sku, product: meta.product, category: meta.category, qty: seed.qty, maxQty: meta.maxQty };
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

// Visual telemetry for a single slot (reuses the original Full/Attention/Low/Empty/Replenishing scheme).
function slotStatus(slot) {
  if (!slot.pallet) {
    if (slot.inbound)
      return { empty: true, pct: 0, label: 'Replenishing',
        cardStyle: 'bg-black border-blue-500 text-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]' };
    return { empty: true, pct: 0, label: 'Empty',
      cardStyle: 'bg-slate-950 border-slate-800 text-slate-600' };
  }
  const { qty, maxQty } = slot.pallet;
  const pct = maxQty ? Math.round((qty / maxQty) * 100) : 0;
  if (slot.inbound && pct < 30)
    return { pct, label: 'Critical + Pending', cardStyle: 'bg-black border-blue-400 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]' };
  if (pct >= 80) return { pct, label: 'Full',             cardStyle: 'bg-emerald-950/80 border-emerald-500 text-emerald-300' };
  if (pct >= 30) return { pct, label: 'Attention Needed', cardStyle: 'bg-amber-950/80 border-amber-500 text-amber-300' };
  return           { pct, label: 'Low Stock',             cardStyle: 'bg-red-950/80 border-red-500 text-red-300' };
}

function badgeStyle(pct, empty) {
  if (empty)      return 'bg-slate-800 text-slate-500 border border-slate-700';
  if (pct >= 80)  return 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50';
  if (pct >= 30)  return 'bg-amber-900/40 text-amber-400 border border-amber-500/50';
  return 'bg-red-900/40 text-red-400 border border-red-500/50';
}

// Movement validation. A pallet may be dropped on a target iff the target is empty (move)
// or already holds the same SKU (top-up / merge). A different product can never displace one.
function classifyDrop(src, tgt) {
  if (!src?.pallet)            return { ok: false, reason: 'no pallet to move' };
  if (src.code === tgt.code)   return { ok: false, reason: 'is the same slot' };
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
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
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n));
        }}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono
          text-slate-200 focus:outline-none focus:border-blue-500 transition"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono
          text-slate-200 focus:outline-none focus:border-blue-500 transition disabled:opacity-40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}

// ── Slot editor / pallet placement modal ─────────────────────────────────────

function SlotModal({ mode, initial, emptyPrimaries, onSave, onEmpty, onClose }) {
  const [form, setForm] = useState(initial);
  const isNew = mode === 'new';

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const applySku = (sku) => {
    const meta = PRODUCTS[sku];
    setForm((p) => ({ ...p, sku, product: meta?.product ?? p.product, category: meta?.category ?? p.category, maxQty: meta?.maxQty ?? p.maxQty }));
  };
  const valid = form.code && form.sku.trim() && form.product.trim() && form.maxQty > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Package size={16} className="text-cyan-400" />
            {isNew ? 'Place Pallet' : `Edit ${initial.code}`}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-md p-1 transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {isNew ? (
              <Select
                label="Primary Location"
                value={form.code}
                onChange={(v) => set('code', v)}
                options={emptyPrimaries.map((c) => ({ value: c, label: c }))}
              />
            ) : (
              <Field label="Location" value={form.code} onChange={() => {}} disabled mono />
            )}
            <Select label="SKU" value={form.sku} onChange={applySku} options={SKU_LIST.map((s) => ({ value: s, label: s }))} />
          </div>
          <Field label="Product Name" value={form.product} onChange={(v) => set('product', v)} placeholder="Product name" />
          <Field label="Category" value={form.category} onChange={(v) => set('category', v)} placeholder="e.g. Semiconductors" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Quantity"     value={form.qty}    min={0} max={form.maxQty} onChange={(v) => set('qty', v)} />
            <NumberField label="Pallet Cap."  value={form.maxQty} min={1}                    onChange={(v) => set('maxQty', v)} />
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5">
            <Toggle label="Replenishment In Transit" checked={form.inbound} onChange={(v) => set('inbound', v)} />
          </div>
          {isNew && emptyPrimaries.length === 0 && (
            <p className="text-[10px] text-amber-400 font-mono">No empty primary slots available — free one up first.</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
          {!isNew ? (
            <button onClick={() => onEmpty(form.code)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition">
              <Trash2 size={12} /> Empty Slot
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
            <button
              onClick={() => valid && onSave(form, isNew)}
              disabled={!valid}
              className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition"
            >
              {isNew ? 'Place Pallet' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single location cell (draggable pallet + drop target) ─────────────────────

function SlotCell({ slot, dragSlot, onPick, onDragStart, onDragEnd, onDrop }) {
  const st  = slotStatus(slot);
  const has = !!slot.pallet;
  const loc = slot.code.slice(-2);

  let drop = null;
  if (dragSlot) drop = dragSlot.code === slot.code ? 'self' : (classifyDrop(dragSlot, slot).ok ? 'ok' : 'bad');
  const ring =
    drop === 'ok'   ? 'ring-2 ring-emerald-400/70' :
    drop === 'bad'  ? 'ring-2 ring-red-500/60'     :
    drop === 'self' ? 'opacity-40'                 : '';

  return (
    <div
      draggable={has}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', slot.code); onDragStart(slot); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const sc = e.dataTransfer.getData('text/plain'); onDrop(sc, slot.code); }}
      onClick={() => onPick(slot)}
      title={slot.code}
      className={`relative rounded-lg border p-2 h-[70px] flex flex-col justify-between select-none transition
        hover:brightness-110 focus:outline-none ${st.cardStyle} ${ring} ${has ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] font-bold tracking-wider opacity-80">{loc}</span>
        {slot.primary && (
          <span className="text-[7px] font-bold px-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 leading-tight">PRIMARY</span>
        )}
      </div>

      {has ? (
        <>
          <div className="leading-tight">
            <p className="text-[9px] font-bold line-clamp-1">{slot.pallet.product}</p>
            <p className="text-[8px] font-mono opacity-60">{slot.pallet.sku}</p>
          </div>
          <div>
            <div className="h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${st.pct}%`, backgroundColor: barColor(st.pct) }} />
            </div>
            <div className="flex justify-between items-center mt-0.5">
              <span className="text-[8px] opacity-60 line-clamp-1">{st.label}</span>
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

// ── A bay = rack of levels (floor at the bottom) ──────────────────────────────

function BayRack({ code2, levels, side, dragSlot, onPick, onDragStart, onDragEnd, onDrop }) {
  const all   = [levels[1], levels[2], levels[3]].flat();
  const total = all.length;
  const occ   = all.filter((s) => s.pallet).length;

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] font-bold text-slate-300 flex items-center gap-1">
          <Layers size={10} className="text-slate-500" /> BAY {code2}
        </span>
        <span className="text-[8px] font-mono text-slate-500">{side} · {occ}/{total}</span>
      </div>
      <div className="space-y-1">
        {[3, 2, 1].map((l) => (
          <div key={l} className="flex items-stretch gap-1">
            <div className={`w-5 flex items-center justify-center rounded text-[8px] font-mono font-bold
              ${l === 1 ? 'bg-cyan-900/40 text-cyan-300' : 'bg-slate-800/60 text-slate-500'}`}>
              L{l}
            </div>
            <div className="grid grid-cols-2 gap-1 flex-1">
              {(levels[l] || []).map((s) => (
                <SlotCell key={s.code} slot={s} dragSlot={dragSlot}
                  onPick={onPick} onDragStart={onDragStart} onDragEnd={onDragEnd} onDrop={onDrop} />
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
      <span className="my-2 font-mono text-[9px] font-bold text-slate-400 tracking-widest [writing-mode:vertical-rl] rotate-180">
        AISLE {aisle}
      </span>
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
  const [modal, setModal]                 = useState(null); // { mode, form }
  const [collapsed, setCollapsed]         = useState({});
  const [dragCode, setDragCode]           = useState(null);
  const [sortKey, setSortKey]             = useState('code');
  const [sortDir, setSortDir]             = useState('asc');

  const addLog = useCallback((type, message) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), type, message }, ...prev]);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const byCode = useMemo(() => {
    const m = {};
    slots.forEach((s) => { m[s.code] = s; });
    return m;
  }, [slots]);

  const layout = useMemo(() => {
    const m = {};
    slots.forEach((s) => { (m[s.aisle] ??= {}); (m[s.aisle][s.bay] ??= []).push(s); });
    return m;
  }, [slots]);

  const emptyPrimaries = useMemo(
    () => slots.filter((s) => s.primary && !s.pallet).map((s) => s.code).sort(),
    [slots],
  );

  const stats = useMemo(() => {
    const occupied   = slots.filter((s) => s.pallet);
    const primaries  = slots.filter((s) => s.primary);
    const stocked    = primaries.filter((s) => s.pallet && s.pallet.qty / s.pallet.maxQty >= 0.3);
    return {
      total:          slots.length,
      occupied:       occupied.length,
      emptyPrimaries: primaries.filter((s) => !s.pallet).length,
      inbound:        slots.filter((s) => s.inbound).length,
      full:           occupied.filter((s) => s.pallet.qty / s.pallet.maxQty >= 0.8).length,
      low:            occupied.filter((s) => s.pallet.qty / s.pallet.maxQty < 0.3).length,
      health:         primaries.length ? Math.round((stocked.length / primaries.length) * 100) : 0,
    };
  }, [slots]);

  // Ledger rows = occupied slots, flattened.
  const pallets = useMemo(
    () => slots.filter((s) => s.pallet).map((s) => ({
      code: s.code, primary: s.primary, inbound: s.inbound, ...s.pallet,
    })),
    [slots],
  );

  const filteredPallets = useMemo(() => {
    if (!searchTerm.trim()) return pallets;
    const t = searchTerm.toLowerCase();
    return pallets.filter((p) =>
      p.code.toLowerCase().includes(t) ||
      p.sku.toLowerCase().includes(t) ||
      p.product.toLowerCase().includes(t) ||
      p.category.toLowerCase().includes(t));
  }, [pallets, searchTerm]);

  const sortedPallets = useMemo(() => {
    const rows = [...filteredPallets];
    rows.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'fill') { av = a.qty / a.maxQty; bv = b.qty / b.maxQty; }
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
      const space  = tgt.pallet.maxQty - tgt.pallet.qty;
      const moved  = Math.min(space, src.pallet.qty);
      const left   = src.pallet.qty - moved;
      setSlots((prev) => prev.map((s) => {
        if (s.code === tgtCode) return { ...s, pallet: { ...s.pallet, qty: s.pallet.qty + moved }, inbound: false };
        if (s.code === srcCode) return { ...s, pallet: left > 0 ? { ...s.pallet, qty: left } : null };
        return s;
      }));
      addLog('system', `Replenished ${tgtCode} with ${moved} × ${src.pallet.sku} from ${srcCode}.`);
    } else {
      setSlots((prev) => prev.map((s) => {
        if (s.code === tgtCode) return { ...s, pallet: src.pallet, inbound: false };
        if (s.code === srcCode) return { ...s, pallet: null };
        return s;
      }));
      addLog('system', `Moved ${src.pallet.sku} pallet ${srcCode} → ${tgtCode}.`);
    }
  }, [byCode, addLog]);

  const onDropMove = useCallback((srcCode, tgtCode) => {
    setDragCode(null);
    if (srcCode && srcCode !== tgtCode) movePallet(srcCode, tgtCode);
  }, [movePallet]);

  // ── Slot picking / modal ─────────────────────────────────────────────────────
  const openEdit = useCallback((slot) => {
    setModal({ mode: 'edit', form: {
      code: slot.code, sku: slot.pallet.sku, product: slot.pallet.product,
      category: slot.pallet.category, qty: slot.pallet.qty, maxQty: slot.pallet.maxQty, inbound: slot.inbound,
    } });
  }, []);

  const openNewAt = useCallback((code) => {
    const sku = SKU_LIST[0];
    setModal({ mode: 'new', form: {
      code: code ?? '', sku, product: PRODUCTS[sku].product, category: PRODUCTS[sku].category,
      qty: 0, maxQty: PRODUCTS[sku].maxQty, inbound: false,
    } });
  }, []);

  const onPick = useCallback((slot) => {
    if (slot.pallet)      openEdit(slot);
    else if (slot.primary) openNewAt(slot.code);
    else addLog('warning', `${slot.code} is a reserve slot — new products must be placed in an empty primary (floor) slot. Drag an existing pallet here instead.`);
  }, [openEdit, openNewAt, addLog]);

  const saveSlot = useCallback((form, isNew) => {
    setSlots((prev) => prev.map((s) => s.code === form.code
      ? { ...s, inbound: form.inbound, pallet: {
          sku: form.sku, product: form.product, category: form.category,
          qty: Math.min(form.qty, form.maxQty), maxQty: form.maxQty } }
      : s));
    addLog('system', isNew
      ? `Placed ${form.sku} (${form.product}) at ${form.code}.`
      : `${form.code} updated — ${form.sku} @ ${fmt(Math.min(form.qty, form.maxQty))} units.`);
    setModal(null);
  }, [addLog]);

  const emptySlot = useCallback((code) => {
    setSlots((prev) => prev.map((s) => s.code === code ? { ...s, pallet: null } : s));
    addLog('warning', `${code} emptied — pallet removed.`);
    setModal(null);
  }, [addLog]);

  // ── Terminal ─────────────────────────────────────────────────────────────────
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    const raw = terminalInput.trim();
    if (!raw) return;
    setTerminalInput('');
    const cmd = raw.toLowerCase();
    const now = new Date().toLocaleTimeString();
    let response = '';

    if (cmd === 'clear') { setLogs([]); return; }

    if (cmd === 'help') {
      response = 'Commands: move <src> <dst> · fill <code> · drain <code> · restock · status · clear · help';
    } else if (cmd === 'status') {
      response = `Slots: ${stats.total} | Occupied: ${stats.occupied} | Empty primaries: ${stats.emptyPrimaries} | Inbound: ${stats.inbound} | Low: ${stats.low}`;
    } else if (cmd.startsWith('move ')) {
      const [, a, b] = raw.split(/\s+/);
      if (byCode[a] && byCode[b]) { movePallet(a, b); response = `move ${a} → ${b} processed.`; }
      else response = `Unknown location(s). Use full codes e.g. "move 0-01-21 0-01-11".`;
    } else if (cmd.startsWith('fill ')) {
      const code = raw.split(/\s+/)[1];
      const s = byCode[code];
      if (s?.pallet) { setSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: { ...x.pallet, qty: Math.floor(x.pallet.maxQty * 0.9) }, inbound: false } : x)); response = `${code} filled to 90%.`; }
      else response = s ? `${code} is empty — nothing to fill.` : `"${code}" not found.`;
    } else if (cmd.startsWith('drain ')) {
      const code = raw.split(/\s+/)[1];
      const s = byCode[code];
      if (s?.pallet) { setSlots((prev) => prev.map((x) => x.code === code ? { ...x, pallet: null } : x)); response = `${code} drained — pallet removed.`; }
      else response = s ? `${code} already empty.` : `"${code}" not found.`;
    } else if (cmd === 'restock') {
      let n = 0;
      setSlots((prev) => prev.map((x) => {
        if (x.pallet && x.pallet.qty / x.pallet.maxQty < 0.3) { n++; return { ...x, pallet: { ...x.pallet, qty: Math.floor(x.pallet.maxQty * 0.85) }, inbound: false }; }
        return x;
      }));
      response = 'All low pallets restocked to 85%.';
    } else {
      response = `Unknown command "${raw}". Type "help" for commands.`;
    }

    setLogs((prev) => [
      { time: now, type: 'ai',   message: response },
      { time: now, type: 'user', message: `> ${raw}` },
      ...prev,
    ]);
  };

  // ── Sorting ────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortHead = ({ col, label }) => (
    <th onClick={() => handleSort(col)} className="pb-3 pr-4 font-medium cursor-pointer select-none hover:text-slate-200 transition group">
      <span className="flex items-center gap-1">
        {label}
        <span className="text-slate-700 group-hover:text-slate-400 transition">
          {sortKey === col ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ChevronUp size={10} className="opacity-0 group-hover:opacity-40" />}
        </span>
      </span>
    </th>
  );

  const dragSlot = dragCode ? byCode[dragCode] : null;
  const toggleAisle = (a) => setCollapsed((c) => ({ ...c, [a]: !c[a] }));
  const resetSim = () => { setSlots(buildSlots()); setSearchTerm(''); setDragCode(null); addLog('system', 'Simulation reset to seed layout.'); };

  const renderBay = (a, b, side) => (
    <BayRack
      key={`${a}-${b}`}
      code2={pad2(b)}
      levels={groupLevels(layout[a]?.[b] || [])}
      side={side}
      dragSlot={dragSlot}
      onPick={onPick}
      onDragStart={(s) => setDragCode(s.code)}
      onDragEnd={() => setDragCode(null)}
      onDrop={onDropMove}
    />
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-6">

      {modal && (
        <SlotModal
          mode={modal.mode}
          initial={modal.form}
          emptyPrimaries={emptyPrimaries}
          onSave={saveSlot}
          onEmpty={emptySlot}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-xs text-slate-950 font-bold px-2 py-0.5 rounded animate-pulse">TELEMETRY ON</span>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">NexusFlow OS</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">Autonomous Spatial Layout &amp; Visualized Stocking Matrix</p>
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
          <span className="text-cyan-400 font-bold">PRIMARY</span> = level&nbsp;1 floor / pick face · upper levels = reserve. Drag a pallet onto an empty slot to move it,
          or onto a slot holding the <span className="text-slate-300">same SKU</span> to top it up. A new product can only be placed in an empty primary slot.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        {[
          { id: 'layout',  icon: <Boxes size={16} />,     label: 'Spatial Warehouse Layout' },
          { id: 'ledger',  icon: <BarChart3 size={16} />, label: 'Item Ledger' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 border-b-2 -mb-px
              ${activeTab === tab.id ? 'border-blue-500 text-blue-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Spatial layout */}
          {activeTab === 'layout' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Boxes className="text-cyan-400" size={18} />
                  <h2 className="font-semibold text-slate-200">AI Floorplan · Aisle / Bay / Location Map</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Live Rack Feed Matrix</span>
                  <button
                    onClick={() => openNewAt(emptyPrimaries[0])}
                    disabled={emptyPrimaries.length === 0}
                    className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-2.5 py-1 rounded-md font-bold transition"
                  >
                    <Plus size={11} /> Place Pallet
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {[...Array(AISLES).keys()].map((a) => (
                  <div key={a} className="border border-slate-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleAisle(a)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-950/60 hover:bg-slate-900 transition"
                    >
                      <span className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200">
                        <MapPin size={12} className="text-cyan-400" /> AISLE {a}
                        <span className="text-[10px] font-normal text-slate-500">
                          {slots.filter((s) => s.aisle === a && s.pallet).length}/{slots.filter((s) => s.aisle === a).length} slots filled
                        </span>
                      </span>
                      {collapsed[a] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
                    </button>

                    {!collapsed[a] && (
                      <div className="p-3 grid grid-cols-[1fr_2.75rem_1fr] gap-3 bg-slate-900/40">
                        {/* Even bays — left wall */}
                        <div className="space-y-3">
                          <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest text-center">left · even</p>
                          {[2, 4, 6].map((b) => renderBay(a, b, 'L'))}
                        </div>
                        {/* Center aisle */}
                        <AisleLane aisle={a} />
                        {/* Odd bays — right wall */}
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
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-cyan-400" size={18} />
                  <h2 className="font-semibold text-slate-200">Inventory Item Ledger</h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{sortedPallets.length} pallets</span>
              </div>

              <div className="relative mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search location, SKU, name, category…"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                      <SortHead col="code"     label="Location" />
                      <SortHead col="sku"      label="SKU" />
                      <SortHead col="product"  label="Name" />
                      <SortHead col="qty"      label="Qty" />
                      <SortHead col="fill"     label="Fill" />
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {sortedPallets.map((p) => {
                      const pct = p.maxQty ? Math.round((p.qty / p.maxQty) * 100) : 0;
                      const st  = slotStatus(byCode[p.code]);
                      return (
                        <tr key={p.code} onClick={() => openEdit(byCode[p.code])} className="hover:bg-slate-800/30 transition cursor-pointer group">
                          <td className="py-3 pr-4 font-mono text-cyan-400">
                            {p.code}{p.primary && <span className="ml-1 text-[8px] text-cyan-600">P</span>}
                          </td>
                          <td className="py-3 pr-4 font-mono text-slate-400 group-hover:text-slate-300">{p.sku}</td>
                          <td className="py-3 pr-4 max-w-[180px]">
                            <p className="text-slate-200 font-medium leading-tight line-clamp-1">{p.product}</p>
                            <p className="text-slate-500 text-[10px]">{p.category}</p>
                          </td>
                          <td className="py-3 pr-4 font-mono">
                            <span className="text-slate-200">{fmt(p.qty)}</span>
                            <span className="text-slate-600"> /{fmt(p.maxQty)}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor(pct) }} />
                              </div>
                              <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeStyle(pct, false)}`}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {sortedPallets.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-8 font-mono">
                    {searchTerm ? 'No pallets match your search.' : 'No pallets stored. Place one from the layout view.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right (1 col) */}
        <div className="space-y-4">

          {/* System summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Cpu size={11} /> System Summary
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'Total Slots',     value: stats.total,          color: 'text-slate-200'   },
                { label: 'Occupied',        value: stats.occupied,       color: 'text-slate-200'   },
                { label: 'Empty Primaries', value: stats.emptyPrimaries, color: 'text-amber-400'   },
                { label: 'Inbound',         value: stats.inbound,        color: 'text-blue-400'    },
                { label: 'Full (>80%)',     value: stats.full,           color: 'text-emerald-400' },
                { label: 'Low / Critical',  value: stats.low,            color: 'text-red-400'     },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`font-mono font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-400">Primary Pick-Face Health</span>
                  <span className="font-mono text-slate-300 text-[10px]">{stats.health}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stats.health}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* AI Terminal */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Terminal size={11} /> NexusFlow AI Terminal
            </h3>
            <p className="text-[10px] font-mono text-slate-600 mb-3 leading-relaxed">
              move &lt;src&gt; &lt;dst&gt; · fill &lt;code&gt; · drain &lt;code&gt;<br />
              restock · status · clear · help
            </p>
            <form onSubmit={handleTerminalSubmit} className="flex gap-2">
              <input
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="enter command…"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 rounded-md font-mono font-bold transition">RUN</button>
            </form>
          </div>

          {/* Live logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={11} /> Live Stream Logs
              </h3>
              {logs.length > 0 && (
                <button onClick={() => setLogs([])} className="text-[10px] text-slate-600 hover:text-slate-400 transition font-mono">clear</button>
              )}
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.length === 0 && <p className="text-[10px] text-slate-600 font-mono">// log cleared</p>}
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-slate-600">[{log.time}] </span>
                  <span className={`font-bold mr-1 ${
                    log.type === 'warning' ? 'text-amber-400' :
                    log.type === 'ai'      ? 'text-purple-400' :
                    log.type === 'user'    ? 'text-cyan-400' : 'text-blue-400'}`}>
                    {log.type.toUpperCase()}:
                  </span>
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
