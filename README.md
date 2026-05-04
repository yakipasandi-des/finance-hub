# Finance Hub

A local-first personal finance dashboard for Israel. Upload your Isracard statements, track savings and pension yields against real GemelNet/PensionNet data, project cash flow, and chat with an AI assistant about your money — all in the browser, with no server and no account.

> All data lives in your browser's `localStorage`. Nothing is uploaded anywhere (except direct, read-only calls to public Israeli government APIs and — if you use the AI chat — Anthropic).

## Features

- **Credit card import** — drop in Isracard `.xlsx` / `.xls` / `.csv` exports and get spending insights, recurring-merchant detection, and category mapping.
- **Savings & pension tracking** — fetches real fund yields from GemelNet and PensionNet (data.gov.il) and tracks your portfolio against an inflation-adjusted goal.
- **Cash flow** — import bank entries (or add them manually), schedule recurring income/expenses, and see a balance projection that accounts for upcoming credit card charges.
- **AI chat** — Hebrew-language financial assistant powered by Claude. Can filter the dashboard and navigate between tabs in response to questions.
- **Budgets & categories** — user-defined parent/child category tree with per-category budget targets.
- **Insights** — top expenses, monthly trends, category breakdowns, and a drag-to-reorder card layout.

## Tech

Vite · React 18 · TypeScript · Recharts · SheetJS · PapaParse · Anthropic SDK

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

The dev server proxies `/anthropic` to `api.anthropic.com` so the AI chat works locally. Set your Anthropic API key in a `.env` file (see `vite.config.ts` for the variable name).

```bash
npm run build    # type-check + bundle
npm run preview  # serve the production build
```

## Deployment note

`vite.config.ts` sets `base: '/finance/'`, so the production build expects to be served from `/finance/` (e.g. `example.com/finance/`). Serving from `/` will break asset paths.

The AI chat proxy is **dev-only**. To use AI chat in production you need a separate backend or proxy that forwards requests to the Anthropic API.

## File format

Isracard's Excel export has a specific shape (multi-section sheets, Hebrew headers, `DD.MM.YY` dates). Parsing rules and column conventions live in [`ISRACARD_FORMAT.md`](./ISRACARD_FORMAT.md).

## Privacy

There is no backend. Transactions, bank entries, savings accounts, and budgets are stored in `localStorage` only and never leave your device — except:

- **GemelNet / PensionNet / CBS** — public, read-only government APIs queried for fund yields and inflation data.
- **Anthropic** — only when you send a message via the AI chat. The chat sends a snapshot of your transactions, budgets, and savings as context.

A "clear all" button in the app wipes every persisted key.
