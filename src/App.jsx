import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw, Search, ShieldAlert, Cpu, Terminal,
  Map, BarChart3, Layers, Plus, Trash2, X,
  ChevronUp, ChevronDown, Pencil,
} from 'lucide-react';

// ── Seed data ──────────────────────────────────────────────────────────────────

const initialInventory = [
  { id: 'SKU-8821', name: 'Lithium-Ion Battery Pack v4',  category: 'Energy Storage', stock: 1420, maxCap: 1500, location: 'Bay A1', leadTime: 14, replenishmentAvailable: false },
  { id: 'SKU-4091', name: 'Micro-Controller Unit (MCU-X)', category: 'Semiconductors', stock: 110,  maxCap: 1000, location: 'Bay A2', leadTime: 45, replenishmentAvailable: true  },
  { id: 'SKU-1102', name: 'Reinforced Aluminum Chassis',  category: 'Structural',     stock: 450,  maxCap: 1000, location: 'Bay B1', leadTime: 21, replenishmentAvailable: false },
  { id: 'SKU-7749', name: 'High-Tensile Copper Wiring',   category: 'Cabling',        stock: 0,    maxCap: 1200, location: 'Bay B2', leadTime: 7,  replenishmentAvailable: false },
  { id: 'SKU-5561', name: 'Optoelectronic Sensor Array',  category: 'Sensors',        stock: 0,    maxCap: 800,  location: 'Bay C1', leadTime: 30, replenishmentAvailable: true  },
];

const logHistory = [
  { time: '13:02:11', type: 'system',  message: 'Color telemetry updated. 2 locations flagged for autonomous replenishment.' },
  { time: '12:54:10', type: 'ai',      message: 'AI demand models recalculated using regional logistics telemetry.' },
  { time: '12:41:22', type: 'warning', message: 'Bay A2 dropped below 15% threshold. Initiating micro-controller rerouting.' },
];

const NEW_ITEM_TEMPLATE = {
  id: '', name: '', category: '', stock: 0,
  maxCap: 1000, location: '', leadTime: 7, replenishmentAvailable: false,
};

// ── Status helpers ─────────────────────────────────────────────────────────────

function getLocationStatus(stock, maxCap, hasReplenishment) {
  if (stock === 0 && hasReplenishment)
    return { label: 'Replenishing',       cardStyle: 'bg-black border-blue-500 text-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]' };
  if (stock === 0)
    return { label: 'Empty',              cardStyle: 'bg-slate-950 border-slate-800 text-slate-600' };
  const pct = (stock / maxCap) * 100;
  if (hasReplenishment && pct < 30)
    return { label: 'Critical + Pending', cardStyle: 'bg-black border-blue-400 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]' };
  if (pct >= 80)
    return { label: 'Full',               cardStyle: 'bg-emerald-950/80 border-emerald-500 text-emerald-400' };
  if (pct >= 30)
    return { label: 'Attention Needed',   cardStyle: 'bg-amber-950/80 border-amber-500 text-amber-400' };
  return   { label: 'Low Stock',          cardStyle: 'bg-red-950/80 border-red-500 text-red-400' };
}

function getBadgeStyle(stock, maxCap, hasReplenishment) {
  if (stock === 0 && hasReplenishment) return 'bg-blue-900/40 text-blue-400 border border-blue-500/50';
  if (stock === 0)                      return 'bg-slate-800 text-slate-500 border border-slate-700';
  const pct = (stock / maxCap) * 100;
  if (hasReplenishment && pct < 30)     return 'bg-red-900/40 text-red-400 border border-red-500/50 animate-pulse';
  if (pct >= 80)                        return 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50';
  if (pct >= 30)                        return 'bg-amber-900/40 text-amber-400 border border-amber-500/50';
  return 'bg-red-900/40 text-red-400 border border-red-500/50';
}

function barColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 30) return '#f59e0b';
  if (pct > 0)   return '#ef4444';
  return '#1e293b';
}

// ── Modal form primitives ──────────────────────────────────────────────────────

function Field({ label, value, onChange, disabled = false, mono = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
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
        onChange={e => {
          const n = Number(e.target.value);
          onChange(max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n));
        }}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono
          text-slate-200 focus:outline-none focus:border-blue-500 transition"
      />
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
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </button>
    </div>
  );
}

// ── Item edit / add modal ──────────────────────────────────────────────────────

function ItemModal({ initialItem, isNew, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initialItem);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const maxStock = form.maxCap > 0 ? form.maxCap : 999999;
  const valid    = form.id.trim() && form.name.trim() && form.location.trim() && form.maxCap > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base text-slate-100">
            {isNew ? 'Add New SKU' : `Edit ${initialItem.id}`}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-md p-1 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="SKU ID"
              value={form.id}
              onChange={v => set('id', v)}
              disabled={!isNew}
              mono
              placeholder="SKU-0000"
            />
            <Field
              label="Location"
              value={form.location}
              onChange={v => set('location', v)}
              mono
              placeholder="Bay A1"
            />
          </div>
          <Field label="Item Name" value={form.name} onChange={v => set('name', v)} placeholder="Product name" />
          <Field label="Category"  value={form.category} onChange={v => set('category', v)} placeholder="e.g. Semiconductors" />
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Stock"      value={form.stock}    min={0}  max={maxStock} onChange={v => set('stock', v)} />
            <NumberField label="Max Cap"    value={form.maxCap}   min={1}                 onChange={v => set('maxCap', v)} />
            <NumberField label="Lead (days)" value={form.leadTime} min={1}                 onChange={v => set('leadTime', v)} />
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5">
            <Toggle
              label="Replenishment In Transit"
              checked={form.replenishmentAvailable}
              onChange={v => set('replenishmentAvailable', v)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
          {!isNew ? (
            <button
              onClick={() => onDelete(form.id)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-3 py-1.5 rounded-lg transition"
            >
              <Trash2 size={12} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => valid && onSave(form)}
              disabled={!valid}
              className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition"
            >
              {isNew ? 'Add Item' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AiInventoryOS() {
  const [activeTab, setActiveTab]         = useState('nodes');
  const [inventory, setInventory]         = useState(initialInventory);
  const [searchTerm, setSearchTerm]       = useState('');
  const [logs, setLogs]                   = useState(logHistory);
  const [terminalInput, setTerminalInput] = useState('');
  const [modal, setModal]                 = useState(null);  // { item, isNew }
  const [sortKey, setSortKey]             = useState('location');
  const [sortDir, setSortDir]             = useState('asc');

  // ── Logging ────────────────────────────────────────────────────────────────
  const addLog = useCallback((type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, type, message }, ...prev]);
  }, []);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const openEdit = useCallback((item) => setModal({ item: { ...item }, isNew: false }), []);
  const openNew  = useCallback(() => {
    const id = `SKU-${Math.floor(Math.random() * 9000 + 1000)}`;
    setModal({ item: { ...NEW_ITEM_TEMPLATE, id }, isNew: true });
  }, []);
  const closeModal = useCallback(() => setModal(null), []);

  const saveItem = useCallback((edited) => {
    setInventory(prev => {
      const exists = prev.some(i => i.id === edited.id);
      const next = exists ? prev.map(i => i.id === edited.id ? edited : i) : [...prev, edited];
      const msg = exists
        ? `${edited.id} updated — ${edited.name} @ ${edited.location}.`
        : `New SKU ${edited.id} (${edited.name}) registered at ${edited.location}.`;
      setTimeout(() => addLog('system', msg), 0);
      return next;
    });
    closeModal();
  }, [addLog, closeModal]);

  const deleteItem = useCallback((id) => {
    setInventory(prev => {
      const item = prev.find(i => i.id === id);
      setTimeout(() => addLog('warning', `${id} (${item?.name}) removed from inventory.`), 0);
      return prev.filter(i => i.id !== id);
    });
    closeModal();
  }, [addLog, closeModal]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredInventory = useMemo(() => {
    if (!searchTerm.trim()) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(i =>
      i.name.toLowerCase().includes(term) ||
      i.id.toLowerCase().includes(term) ||
      i.category.toLowerCase().includes(term) ||
      i.location.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  const sortedInventory = useMemo(() => {
    return [...filteredInventory].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filteredInventory, sortKey, sortDir]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const criticalCount  = inventory.filter(i => i.stock === 0 || (i.stock / i.maxCap) < 0.15).length;
  const replenishCount = inventory.filter(i => i.replenishmentAvailable).length;
  const fullCount      = inventory.filter(i => (i.stock / i.maxCap) >= 0.8).length;
  const fleetHealth    = Math.round((fullCount / (inventory.length || 1)) * 100);

  // ── Terminal ───────────────────────────────────────────────────────────────
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    const raw = terminalInput.trim();
    if (!raw) return;
    const cmd = raw.toLowerCase();
    setTerminalInput('');

    if (cmd === 'clear') { setLogs([]); return; }

    const now = new Date().toLocaleTimeString();
    let response = '';

    if (cmd === 'help') {
      response = 'Commands: restock · fill <bay> · drain <bay> · status · add · clear';
    } else if (cmd === 'status') {
      response = `Fleet: ${inventory.length} SKUs | Critical: ${criticalCount} | Replenishing: ${replenishCount} | Full: ${fullCount}`;
    } else if (cmd === 'add') {
      openNew();
      response = 'Opening new SKU dialog…';
    } else if (cmd.startsWith('fill ')) {
      const target = cmd.slice(5).trim().toUpperCase();
      const item = inventory.find(i =>
        i.location.toUpperCase() === target || i.id.toUpperCase() === target
      );
      if (item) {
        setInventory(prev => prev.map(i =>
          i.id === item.id ? { ...i, stock: Math.floor(i.maxCap * 0.9), replenishmentAvailable: false } : i
        ));
        response = `${item.location} (${item.id}): stocked to 90%.`;
      } else {
        response = `"${target}" not found. Bays: ${inventory.map(i => i.location).join(', ')}.`;
      }
    } else if (cmd.startsWith('drain ')) {
      const target = cmd.slice(6).trim().toUpperCase();
      const item = inventory.find(i =>
        i.location.toUpperCase() === target || i.id.toUpperCase() === target
      );
      if (item) {
        setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock: 0 } : i));
        response = `${item.location} (${item.id}): drained to zero.`;
      } else {
        response = `"${target}" not found.`;
      }
    } else if (cmd === 'restock') {
      setInventory(prev => prev.map(i =>
        i.stock === 0 || i.stock < 200
          ? { ...i, stock: Math.floor(i.maxCap * 0.85), replenishmentAvailable: false }
          : i
      ));
      response = 'All critical / empty locations restocked to 85%.';
    } else {
      response = `Unknown command "${raw}". Type "help" for available commands.`;
    }

    setLogs(prev => [
      { time: now, type: 'ai',   message: response },
      { time: now, type: 'user', message: `> ${raw}` },
      ...prev,
    ]);
  };

  // ── Sortable column header ─────────────────────────────────────────────────
  const SortHead = ({ col, label }) => (
    <th
      onClick={() => handleSort(col)}
      className="pb-3 pr-4 font-medium cursor-pointer select-none hover:text-slate-200 transition group"
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-slate-700 group-hover:text-slate-400 transition">
          {sortKey === col
            ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
            : <ChevronUp size={10} className="opacity-0 group-hover:opacity-40" />
          }
        </span>
      </span>
    </th>
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans p-6">

      {/* Modal */}
      {modal && (
        <ItemModal
          initialItem={modal.item}
          isNew={modal.isNew}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={closeModal}
        />
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-xs text-slate-950 font-bold px-2 py-0.5 rounded animate-pulse">TELEMETRY ON</span>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              NexusFlow OS
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">Autonomous Spatial Layout &amp; Visualized Stocking Matrix</p>
        </div>
        <button
          onClick={() => { setInventory(initialInventory); setLogs(logHistory); setSearchTerm(''); }}
          className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg text-slate-300 transition"
        >
          <RefreshCw size={14} /> Reset Simulation
        </button>
      </header>

      {/* ── Legend ─────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 my-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Visual Telemetry Rules</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {[
            { dot: 'bg-emerald-500',                  border: 'border-emerald-500/30',              label: 'Green: Full (>80%)' },
            { dot: 'bg-amber-500',                    border: 'border-amber-500/30',                label: 'Yellow: Mid / Attention' },
            { dot: 'bg-red-500',                      border: 'border-red-500/30',                  label: 'Red: Low Inventory' },
            { dot: 'bg-slate-800 border border-slate-700', border: 'border-slate-800',              label: 'Black: Empty Location' },
            { dot: 'bg-blue-500',                     border: 'border-blue-500',   pulse: true, labelClass: 'font-semibold text-slate-200', label: 'Blue: Replenishing' },
          ].map(({ dot, border, label, pulse, labelClass = 'text-slate-300' }) => (
            <div key={label} className={`flex items-center gap-2 bg-slate-950 p-2 rounded-md border ${border} ${pulse ? 'animate-pulse' : ''}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} />
              <span className={`text-[11px] ${labelClass}`}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        {[
          { id: 'nodes',     icon: <Map size={16} />,       label: 'Spatial Warehouse Layout' },
          { id: 'dashboard', icon: <BarChart3 size={16} />, label: 'Item Ledger' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left (2 cols) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Spatial Layout */}
          {activeTab === 'nodes' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="text-cyan-400" size={18} />
                  <h2 className="font-semibold text-slate-200">AI Floorplan Micro-Location Mapping</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400">Live Rack Feed Matrix</span>
                  <button
                    onClick={openNew}
                    className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md font-bold transition"
                  >
                    <Plus size={11} /> Add Bay
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {inventory.map((item, idx) => {
                  const { label, cardStyle } = getLocationStatus(item.stock, item.maxCap, item.replenishmentAvailable);
                  const pct = item.maxCap ? Math.round((item.stock / item.maxCap) * 100) : 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => openEdit(item)}
                      className={`border p-4 rounded-xl transition-all duration-200 flex flex-col justify-between h-36 text-left
                        relative group hover:brightness-110 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        ${cardStyle}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-mono font-bold text-xs tracking-wider opacity-90">{item.location}</span>
                        <div className="flex items-center gap-1.5">
                          {item.replenishmentAvailable && (
                            <span className="bg-blue-500 text-slate-950 font-extrabold text-[8px] px-1 rounded animate-bounce leading-tight whitespace-nowrap">
                              INBOUND
                            </span>
                          )}
                          <Pencil size={10} className="text-slate-400 opacity-0 group-hover:opacity-60 transition" />
                        </div>
                      </div>

                      <div className="my-1">
                        <h4 className="font-bold text-xs leading-tight line-clamp-2 text-slate-100">{item.name}</h4>
                        <p className="text-[10px] opacity-60 mt-0.5 font-mono">{item.id}</p>
                      </div>

                      <div>
                        <div className="h-1 bg-slate-800/80 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: barColor(pct) }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[10px] opacity-60">{label}</span>
                          <span className="text-[10px] font-mono font-bold">{pct}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Add location placeholder */}
                <button
                  onClick={openNew}
                  className="border border-dashed border-slate-700 hover:border-blue-600 hover:bg-blue-950/20
                    p-4 rounded-xl h-36 flex flex-col items-center justify-center gap-2
                    text-slate-600 hover:text-blue-400 transition group focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <Plus size={20} className="group-hover:scale-110 transition" />
                  <span className="text-xs font-medium">Add Location</span>
                </button>
              </div>
            </div>
          )}

          {/* Item Ledger */}
          {activeTab === 'dashboard' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-cyan-400" size={18} />
                  <h2 className="font-semibold text-slate-200">Inventory Item Ledger</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400">{sortedInventory.length} items</span>
                  <button
                    onClick={openNew}
                    className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md font-bold transition"
                  >
                    <Plus size={11} /> New SKU
                  </button>
                </div>
              </div>

              <div className="relative mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search SKU, name, category, location…"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-2 text-xs
                    text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                      <SortHead col="id"       label="SKU" />
                      <SortHead col="name"     label="Name" />
                      <SortHead col="location" label="Loc" />
                      <SortHead col="stock"    label="Stock" />
                      <th className="pb-3 pr-4 font-medium">Fill</th>
                      <SortHead col="leadTime" label="Lead" />
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {sortedInventory.map(item => {
                      const pct   = item.maxCap ? Math.round((item.stock / item.maxCap) * 100) : 0;
                      const { label } = getLocationStatus(item.stock, item.maxCap, item.replenishmentAvailable);
                      const badge = getBadgeStyle(item.stock, item.maxCap, item.replenishmentAvailable);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => openEdit(item)}
                          className="hover:bg-slate-800/30 transition cursor-pointer group"
                        >
                          <td className="py-3 pr-4 font-mono text-slate-400 group-hover:text-slate-300">{item.id}</td>
                          <td className="py-3 pr-4 max-w-[180px]">
                            <p className="text-slate-200 font-medium leading-tight line-clamp-1">{item.name}</p>
                            <p className="text-slate-500 text-[10px]">{item.category}</p>
                          </td>
                          <td className="py-3 pr-4 font-mono text-cyan-400">{item.location}</td>
                          <td className="py-3 pr-4 font-mono">
                            <span className="text-slate-200">{item.stock.toLocaleString()}</span>
                            <span className="text-slate-600"> /{item.maxCap.toLocaleString()}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: barColor(pct) }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-400">{item.leadTime}d</td>
                          <td className="py-3">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge}`}>
                              {label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {sortedInventory.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-8 font-mono">
                    {searchTerm ? 'No items match your search.' : 'No inventory items. Click "+ New SKU" to add one.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right (1 col) ─────────────────────────────── */}
        <div className="space-y-4">

          {/* System Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Cpu size={11} /> System Summary
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'Total SKUs',        value: inventory.length, color: 'text-slate-200'   },
                { label: 'Critical / Empty',  value: criticalCount,    color: 'text-red-400'     },
                { label: 'Replenishing',      value: replenishCount,   color: 'text-blue-400'    },
                { label: 'Full (>80%)',        value: fullCount,        color: 'text-emerald-400' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`font-mono font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-400">Fleet Health</span>
                  <span className="font-mono text-slate-300 text-[10px]">{fleetHealth}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${fleetHealth}%` }}
                  />
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
              restock · fill &lt;bay&gt; · drain &lt;bay&gt;<br />
              status · add · clear · help
            </p>
            <form onSubmit={handleTerminalSubmit} className="flex gap-2">
              <input
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                placeholder="enter command…"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono
                  text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 rounded-md font-mono font-bold transition"
              >
                RUN
              </button>
            </form>
          </div>

          {/* Live Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={11} /> Live Stream Logs
              </h3>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition font-mono"
                >
                  clear
                </button>
              )}
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.length === 0 && (
                <p className="text-[10px] text-slate-600 font-mono">// log cleared</p>
              )}
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-slate-600">[{log.time}] </span>
                  <span className={`font-bold mr-1 ${
                    log.type === 'warning' ? 'text-amber-400' :
                    log.type === 'ai'      ? 'text-purple-400' :
                    log.type === 'user'    ? 'text-cyan-400' :
                    'text-blue-400'
                  }`}>
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
