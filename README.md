# Nexus POS

A complete, **offline-first** Point of Sale system for shops and stores — from a small grocery to a large multi-till retailer. Built as a desktop app (Windows / Linux / macOS) with optional cloud backup to **MongoDB Atlas**. Ships as a single installer that "just runs": no database server to install, no internet required.

---

## ✨ What it does

| Module | Highlights |
| --- | --- |
| **Sell / Register** | Fast touch + barcode checkout, cart with per-line & order discounts, hold/recall sales, cash/card/mobile/credit payments, change calculation, instant PDF receipt |
| **Inventory** | Products, categories, cost/price/margin, tax per item, barcodes, stock tracking with full movement history, low-stock & out-of-stock alerts, manual stock adjustments |
| **Customers** | Profiles, **accounts receivable** (credit/pending payments), opening balances, credit limits, running ledger, receive payments |
| **Vendors** | Profiles, **accounts payable** (what you owe), opening balances, ledger, record payments |
| **Purchases** | Record stock bought from vendors, auto-updates stock & cost, partial payments create payables |
| **Expenses** | Categorised operating expenses feeding into Profit & Loss |
| **Dashboard** | Live KPIs, 14-day sales & profit trend, sales-by-category donut, hourly sales pattern, top products, payment-method split, recent sales, low-stock list |
| **Forecasting** | Sales projection (linear trend + weekday seasonality), next 7/30-day revenue estimate, growth rate |
| **Reports** | **Profit & Loss**, **Balance Sheet**, **Daily Sales Sheet** — all exportable |
| **Settings** | Shop profile, currency, invoice numbering, receipt size, **backup plan selection**, users & roles |

### 📤 Export everything
Every report and list exports to **PDF, Excel (.xlsx) and CSV**: balance sheet, daily sales sheet, profit & loss, sales report, inventory, customer/vendor ledgers, purchases, expenses — plus thermal **receipt PDFs** (58mm / 80mm).

### 🔐 Users & roles
PIN login with **Owner / Manager / Cashier** roles. Default seeded accounts:
- **Store Owner** — PIN `1234`
- **Cashier** — PIN `1111`

---

## ☁️ Backup plans (user-selectable in Settings)

1. **Offline Only** — everything stays on the machine. Automatic rolling local snapshots (last 14) are kept as a safety net. Zero setup, no internet.
2. **Local / Network Backup** — additionally mirror snapshots to a USB drive, network share, or any folder you choose.
3. **Cloud Backup (MongoDB Atlas)** — bi-directional sync to your Atlas cluster. Works offline and syncs changed documents (last-write-wins, soft-delete tombstones) when a connection is available. Paste your `mongodb+srv://…` connection string and click **Test Connection**.

All three plans always keep the local rolling snapshot, so data is never only in one place.

---

## 🧱 Architecture & tech stack

```
┌──────────────────────────── Electron desktop app ────────────────────────────┐
│  Renderer (React 18 + TypeScript + Vite + Tailwind + Recharts)                │
│     pages/ register, inventory, customers, vendors, purchases, sales,         │
│            expenses, dashboard, forecast, reports, settings                   │
│        │  window.api (typed)                                                  │
│        ▼  contextBridge / IPC                                                  │
│  Preload (secure bridge, contextIsolation on)                                 │
│        │                                                                      │
│        ▼                                                                      │
│  Main process (Node)                                                          │
│     repositories → embedded document store (@seald-io/NeDB, Mongo-style)      │
│     services → backup (local snapshots) + cloudSync (MongoDB Atlas driver)    │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Data model:** the local store uses MongoDB-style documents and queries, so the same records sync to MongoDB Atlas with no transformation. Pure-JavaScript embedded engine ⇒ **no native modules to compile** ⇒ the installer builds and runs anywhere.
- **Type-safe end to end:** one `PosApi` contract shared by the renderer and main process (`shared/ipc.ts`).
- **Money math** is rounded consistently in the main process; the renderer only displays.

### Project structure
```
electron/
  main/
    db/            datastore (NeDB wrapper), settings, seed, util
      repositories/  products, parties, sales, purchases, expenses, users, reports, forecast
    services/      backup.ts (snapshots, scheduling), cloudSync.ts (Atlas push/pull)
    ipc/router.ts  maps every API method → repository
    index.ts       app lifecycle, window, IPC registration
  preload/index.ts secure window.api bridge
shared/            types.ts (domain), ipc.ts (API + report contracts)
src/               React renderer (pages/, components/, store/, lib/)
scripts/smoke.ts   headless data-layer test (npm test)
```

---

## 🚀 Getting started

```bash
npm install        # installs deps (no native build step)
npm run dev        # launches the app in development with hot reload
```

### Verify the data layer (headless, no display needed)
```bash
npm test           # runs 30 checks: checkout, ledgers, purchases, refunds, reports, forecast
```

### Type-check / build
```bash
npm run typecheck  # node + web TS projects
npm run build      # bundles main, preload and renderer into out/
```

---

## 📦 Building the installer to ship to shopkeepers

```bash
npm run dist:win     # Windows  → release/<version>/Nexus POS-Setup-<version>.exe
npm run dist:linux   # Linux    → AppImage + .deb
npm run dist:mac     # macOS    → .dmg
```

The Windows build produces a normal **NSIS `.exe` installer** (`electron-builder.yml`). Send that single file to a shop — they run it, approve the install, and the POS is ready. No MongoDB, runtime, or extra setup required.

> Cross-compiling Windows installers from Linux works best on a Windows machine or CI runner; `electron-builder` will fetch the needed toolchain.

---

## 💾 Where data lives

| What | Location (per OS `userData`) |
| --- | --- |
| Database | `…/Nexus POS/data/*.db` |
| Local snapshots | `…/Nexus POS/backups/backup-<timestamp>/` |

On Windows that base path is `%APPDATA%/Nexus POS`. Restore the latest snapshot from **Settings → Restore latest backup**.

---

## Notes
- First launch creates only the two staff accounts (Store Owner / Cashier) and default settings — the catalog, customers, vendors and sales all start empty, ready for real data.
- Cloud sync uses the official `mongodb` driver and is loaded lazily, so the app runs perfectly with no cloud configured.
