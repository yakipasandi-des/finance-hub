# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Type-check (tsc -b) then bundle with Vite
npm run preview  # Serve the production build locally
```

No test runner is configured yet.

## What This Is

A **local, no-backend web app** (Vite + React + TypeScript) that parses Isracard credit card Excel exports and displays spending insights in the browser. No server, no database, no accounts — files are read entirely client-side.

## Architecture

**Data flow:**
`FileUpload` → `parseFiles()` → `Transaction[]` state in `App` → `Dashboard`

**Key constraint:** Isracard exports do **not** include categories. The app groups by merchant. Future category assignment will be user-driven (in-memory or localStorage).

## Isracard File Format

Defined in `ISRACARD_FORMAT.md`. Critical parsing rules:

- Sheet name: `"פירוט עסקאות"`
- Header rows are detected by col A === `"תאריך רכישה"` — there are **multiple sections** per file
- Date format: `DD.MM.YY` → parsed as `DD.MM.20YY`
- **Amount: always use col E (`סכום חיוב`)** — the actual ₪ charged amount
- Stop each section when col A is empty, col B contains `"סה"כ"`, or col A is not a date

## Types

`src/types.ts` — the central `Transaction` interface:
```ts
{ date, merchant, amount, originalAmount?, currency?, notes?, category? }
```
`category` is optional — Isracard provides none.

## Styling

- Global CSS variables in `src/index.css` (`--bg-primary`, `--accent`, `--green`, `--red`, etc.)
- All components use inline `styles` objects typed as `Record<string, React.CSSProperties>`
- RTL everywhere: `html { direction: rtl }`, Hebrew UI text throughout
- Font: Noto Sans Hebrew via Google Fonts CDN (loaded in `index.html`)
- Color palette: green `#0d9488`, red `#e11d48`, accent `#4338ca`, amber `#b45309`

## Accepted File Types

`.xlsx`, `.xls` (SheetJS), `.csv` (PapaParse), `.pdf` (not yet supported — logs a warning).
Multiple files can be uploaded; `parseFiles()` deduplicates by `date|merchant|amount`.
