# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Eagle View is a single-page React demo of a **beverage-distribution warehouse management UI** — a spatial aisle/bay/location map with drag-and-drop pallet moves, case/each units of measure, and live telemetry. It is a front-end-only simulation: all state is in-memory, there is no backend, API, router, or persistence (a page refresh resets everything; the "Reset Simulation" button rebuilds from seed data).

## Commands

```bash
npm install        # install dependencies
npm run dev        # Vite dev server with HMR at http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the built bundle
```

There is **no test runner and no linter/formatter configured** — `npm run build` (or the dev server) is the only correctness gate. The build fails on bad imports, so it catches most mistakes; run it after non-trivial edits.

## Architecture

**Effectively the entire application lives in `src/App.jsx`.** `main.jsx` just mounts `<App>` and `index.css` pulls in Tailwind. The "components" (`LocationModal`, `SlotCell`, `BayRack`, `AisleLane`, `ProductThumb`, and form primitives `Field`/`NumberField`/`Select`/`Toggle`) are all defined at the **top level of that one file**, not in separate modules. Keep presentational components at module top level — defining them inside the main component would remount them every render and break native drag-and-drop.

Stack: React 18 (`StrictMode`), Vite, Tailwind CSS (utility classes inline; `tailwind.config.js` is stock), and `lucide-react` for icons.

### Data model (location-centric)

The warehouse is a fixed grid sized by four constants at the top of `App.jsx`:
`AISLES × BAYS_PER_AISLE × LEVELS × POSITIONS` (currently 2 × 6 × 3 × 2 = **72 slots**). Change these to resize the warehouse.

- **Slot code grammar**: `aisle-bay-(level)(position)`, e.g. `0-01-11` (aisle 0, bay 01, level 1, position 1). Level 1 is the **primary** pick face (floor); levels 2+ are **reserve**.
- **Units of measure**: every pallet is a `Pallet → Cases → Eaches` hierarchy. Quantity is stored as a single `eaches` integer and *derived* into cases + loose, fill %, and liquid volume via helpers (`maxEaches`, `fillPct`, `splitCases`, `totalMl`, `fmtVolume`).
- **`PRODUCTS`** is the SKU catalog (name, category, `unit`, `eachesPerCase`, `casesPerPallet`, `volumePerEach`). **`SEED`** maps slot codes to initial contents (`{ sku, cases, loose? }` or `{ inbound: true }`). `buildSlots()` expands these into the 72-slot array.
- **Pallet objects are denormalized**: at placement, UoM fields are copied from `PRODUCTS` onto the pallet so each slot is independently editable without mutating the catalog.

### State and data flow

`slots` (a flat array of slot objects) is the **single source of truth**, held in the top-level `EagleView` component. Everything else is either UI state (`modal`, `dragCode`, `searchTerm`, `sortKey`/`sortDir`, `collapsed`, `activeTab`, `logs`) or a `useMemo` derivation of `slots`: `byCode` (lookup), `layout` (aisle→bay grouping for rendering), `emptyPrimaries`, `stats`, and the `pallets`/`filteredPallets`/`sortedPallets` chain that feeds the ledger table.

All mutations are pure, immutable `setSlots(prev => prev.map(...))` updates, centralized in a handful of callbacks: `movePallet` (drag), `adjustEaches` (pick/receive by case or single), `saveEdit`, `placePallet`, `emptySlot`. They also append to `logs` via `addLog`.

### Movement and placement rules

`classifyDrop(src, tgt)` is the one place that decides drop legality and is reused by both drag-and-drop and the terminal `move` command:
- Target **empty** → move the whole pallet.
- Target holds the **same SKU** → top-up/merge (combine eaches up to the target's capacity; remainder stays at source).
- Target holds a **different SKU** → rejected (a pallet never displaces another product).
- A **new** product can only be introduced into an **empty primary** slot (enforced by `onPick`: clicking an empty primary opens the place flow; empty reserve slots only accept drags of existing pallets).

Drag-and-drop is **native HTML5** (`draggable` + `dataTransfer`), so it works with a mouse but **not on touchscreens**.

### Visual telemetry and layout conventions

`slotStatus(slot)` maps fill % to the color states surfaced in the legend: Full (green ≥80%), Attention (amber ≥30%), Low (red), Empty (black), and Replenishing (blue, pulsing, driven by the `inbound` flag). `barColor(pct)` gives the fill-bar color.

Spatial rendering: **odd bays line the right wall, even bays the left**, across a center aisle lane; each bay is a rack drawn **floor-at-bottom** (level 1 lowest). Aisles are collapsible.

### Where common changes go

- New product → add to `PRODUCTS`. Different starting stock → edit `SEED`. Resize warehouse → the four dimension constants.
- Adding a lucide icon requires a valid named export from `lucide-react` or the build breaks. Note the existing code deliberately avoids importing lucide's `Map` icon and uses a plain object (not a JS `Map`) for `byCode`.
