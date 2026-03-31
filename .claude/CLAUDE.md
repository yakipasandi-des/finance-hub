# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Type-check (tsc -b) then bundle with Vite
npm run preview  # Serve the production build locally
```

No test runner is configured yet.

**Important:** `vite.config.ts` sets `base: '/finance/'` — all asset paths assume deployment under `/finance/`. Serving the production build from `/` will break routing and assets.

## What This Is

A **local, client-side web app** (Vite + React 18 + TypeScript) for personal finance in Israel. Core features:

1. **Credit card parsing** — imports Isracard Excel/CSV exports, displays spending insights
2. **Savings & pension tracking** — pulls real yield data from GemelNet/PensionNet APIs (data.gov.il)
3. **Cash flow** — bank entry import + manual entries, balance projection with credit card charges
4. **AI chat** — financial assistant powered by Anthropic SDK, proxied via Vite dev server
5. **Budgets & categories** — user-defined categories with parent/child hierarchy, budget targets

No server, no database, no accounts — all persistence is via `localStorage`.

## Architecture

**App-level flow:**
`FileUpload` → `parseFiles()` → `Transaction[]` in `App` state → `CategoriesProvider` → `Dashboard`

**Dashboard is a tabbed SPA** with 6 tabs: `insights | savings | mapping | transactions | cashflow | settings`

**State management — all hooks persist to localStorage:**
- `useCategoryMap` — merchant → category assignment (since Isracard has no categories)
- `useSavings` — savings/pension accounts and yield data
- `useBudgets` — per-category budget targets
- `useManualEntries` — recurring income/expense entries
- `useBankEntries` — bank transactions (imported or manual)
- `useCreditCardPayments` — credit card charge dates for cash flow
- `useRecurringMerchants` — user overrides for recurring detection. **Note:** toggling logic is inverted — for auto-detected recurring merchants (via `notes`), being in the Set means *excluded*; for others, being in the Set means *included*
- `useCardLayout` — drag-to-reorder dashboard card positions

**Context providers:**
- `CategoriesContext` — user-editable category tree (parent + sub-categories), persisted to localStorage
- `FilterContext` — global month/category/amount filters, wraps all Dashboard content

**External APIs (no auth required):**
- GemelNet/PensionNet: `data.gov.il` CKAN datastore API for fund yields (`src/utils/gemelnet.ts`)
- CBS inflation: `apis.cbs.gov.il` for CPI data (`src/utils/inflation.ts`)
- Anthropic: proxied through Vite dev server (`/anthropic` → `api.anthropic.com`), uses `@anthropic-ai/sdk`. **Dev-only** — production builds have no proxy, so AI chat requires a separate backend or proxy to work.

**AI chat architecture:**
- `useAiChat` hook builds a data snapshot (`buildDataSnapshot.ts`) of transactions, budgets, savings, filters
- Sends to Claude with a Hebrew system prompt; expects JSON response with `AiBlock[]` (text, table, filter/navigate actions)
- Chat can trigger filter changes and tab navigation via action blocks

## Isracard File Format

Defined in `ISRACARD_FORMAT.md`. Critical parsing rules:

- Sheet name: `"פירוט עסקאות"`
- Header rows are detected by col A === `"תאריך רכישה"` — there are **multiple sections** per file
- Date format: `DD.MM.YY` → parsed as `DD.MM.20YY`
- **Amount: always use col E (`סכום חיוב`)** — the actual ₪ charged amount
- Stop each section when col A is empty, col B contains `"סה"כ"`, or col A is not a date

## Types

`src/types.ts` — central interfaces. Key non-obvious relationships:
- `SavingsAccount.fundDataset` (`'gemel' | 'pensia'`) determines which API to call; some fund types (`bituach`, `polisat`, `other`) have no API
- `BankEntry.source` (`'import' | 'manual'`) distinguishes imported bank rows from user-added entries
- `AiBlock` is a union: `text | table | action(filter) | action(navigate)` — the chat UI renders each variant differently

`src/categories.ts` — `Category` with parent/child tree. Categories are user-editable and persisted; Isracard provides none.

## Styling

- Global CSS variables in `src/index.css` (`--bg-primary`, `--accent`, `--green`, `--red`, etc.)
- All components use inline `styles` objects typed as `Record<string, React.CSSProperties>`
- RTL everywhere: `html { direction: rtl }`, Hebrew UI text throughout
- Font: Noto Sans Hebrew via Google Fonts CDN (loaded in `index.html`)
- Color palette: green `#0d9488`, red `#e11d48`, accent `#4338ca`, amber `#b45309`

## Accepted File Types

`.xlsx`, `.xls` (SheetJS), `.csv` (PapaParse), `.pdf` (not yet supported — logs a warning).
Multiple files can be uploaded; `parseFiles()` deduplicates by `date|merchant|amount`.

## localStorage Keys

`merchantCategoryMap`, `categories`, `savings`, `budgets`, `manualEntries`, `bankEntries`, `bankSettings`, `recurringMerchants`, `savings-goal`, `inflationData`. All cleared via the "clear all" button in `App`. **No schema versioning or migration** — changing a persisted type's shape can break existing users' localStorage.
