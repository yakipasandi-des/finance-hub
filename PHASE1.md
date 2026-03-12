# Phase 1 — Project Foundation

## Goal
A working Electron desktop app with React UI, SQLite database, sidebar navigation, and a Settings page where credentials are stored encrypted.

## Critical Requirements
- Windows 11 compatible
- Node.js v24+ is installed
- All UI in Hebrew, RTL direction
- Font: Noto Sans Hebrew — MUST be bundled locally (do NOT load from Google Fonts CDN, Electron CSP blocks it)

## Tech Stack — Use Exactly These
| Tool | Version/Notes |
|------|--------------|
| Electron | Latest stable via electron-forge |
| electron-forge | With webpack-typescript template |
| React | 18+ with TypeScript |
| React Router | v6 for page navigation |
| better-sqlite3 | For local SQLite database |
| electron safeStorage | For encrypting credentials |

## Known Issues to Avoid
These are common Electron + Webpack problems. Handle them proactively:

1. **`__dirname is not defined`** — Webpack replaces `__dirname` in renderer. In `webpack.renderer.config.ts`, set `node: { __dirname: true, __filename: true }`, or avoid using `__dirname` in renderer code entirely. Keep all file-path logic in the main process.

2. **Google Fonts blocked by CSP** — Do NOT use `<link>` to Google Fonts CDN. Download Noto Sans Hebrew `.woff2` files and include them locally via `@font-face` in CSS.

3. **better-sqlite3 native module** — Add to `webpack.main.config.ts` externals: `externals: { 'better-sqlite3': 'commonjs better-sqlite3' }`. Run `npx electron-rebuild` after installing.

4. **Blank screen / renderer not loading** — Make sure `nodeIntegration: false` and `contextIsolation: true` in BrowserWindow. Use a preload script for IPC. Do NOT use `require()` in renderer.

5. **Sandbox errors on Windows** — Set `sandbox: false` in webPreferences if you hit sandbox-related crashes during development.

## Project Structure
```
finance-hub/
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron main process
│   │   ├── database.ts           # SQLite setup + queries
│   │   ├── ipc-handlers.ts       # IPC channel handlers
│   │   └── preload.ts            # Preload script (contextBridge)
│   ├── renderer/
│   │   ├── App.tsx               # Root component with Router
│   │   ├── index.tsx             # Entry point
│   │   ├── index.html            # HTML template
│   │   ├── styles/
│   │   │   └── globals.css       # Global styles + @font-face
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     # Placeholder — "לוח מחוונים — בקרוב"
│   │   │   ├── Transactions.tsx  # Placeholder — "עסקאות — פאזה 2"
│   │   │   ├── Categories.tsx    # Placeholder — "קטגוריות — פאזה 2"
│   │   │   ├── Recurring.tsx     # Placeholder — "הוצאות קבועות — פאזה 3"
│   │   │   ├── Portfolio.tsx     # Placeholder — "תיק השקעות — פאזה 5"
│   │   │   └── Settings.tsx      # Full settings page
│   │   └── components/
│   │       └── Sidebar.tsx       # Navigation sidebar
│   └── shared/
│       └── types.ts              # Shared TypeScript interfaces
├── assets/
│   └── fonts/
│       └── NotoSansHebrew-*.woff2  # Bundled font files
├── data/                         # SQLite database location (gitignored)
├── package.json
├── webpack.main.config.ts
├── webpack.renderer.config.ts
├── forge.config.ts
└── tsconfig.json
```

## Database Schema

Create a file `src/main/database.ts` that initializes SQLite with these tables:

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('bank','credit_card','investment')),
  provider TEXT NOT NULL,
  credentials_encrypted TEXT,
  last_sync TEXT,
  sync_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  original_category TEXT,
  is_recurring INTEGER DEFAULT 0,
  recurring_rule_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  budget_monthly REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_pattern TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  priority INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  frequency TEXT NOT NULL CHECK(frequency IN ('monthly','quarterly','annual')),
  day_of_month INTEGER,
  start_date TEXT,
  end_date TEXT,
  account_id INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS portfolio_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT,
  value REAL DEFAULT 0,
  last_updated TEXT,
  source TEXT DEFAULT 'manual' CHECK(source IN ('manual','auto')),
  change_pct REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Insert default categories:
```sql
INSERT OR IGNORE INTO categories (id, name, icon, color, budget_monthly, sort_order) VALUES
(1, 'דיור', '🏠', '#4338ca', 0, 1),
(2, 'מזון', '🛒', '#0d9488', 0, 2),
(3, 'תחבורה', '🚗', '#b45309', 0, 3),
(4, 'בילויים', '🎬', '#e11d48', 0, 4),
(5, 'מנויים', '📱', '#7c3aed', 0, 5),
(6, 'אחר', '📦', '#78716c', 0, 6);
```

## Database Location — IMPORTANT
Store the SQLite database at `C:\Users\<username>\.finance-hub\finance.db` — NOT inside the project folder, and NOT inside any OneDrive/Dropbox/Google Drive synced folder. Create this directory on first launch if it doesn't exist.

## Preload Script + IPC

The preload script exposes a safe API to the renderer via contextBridge:

```typescript
// preload.ts — expose these channels
contextBridge.exposeInMainWorld('electronAPI', {
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  credentials: {
    save: (provider: string, credentials: object) => ipcRenderer.invoke('credentials:save', provider, credentials),
    exists: (provider: string) => ipcRenderer.invoke('credentials:exists', provider),
    delete: (provider: string) => ipcRenderer.invoke('credentials:delete', provider),
  },
});
```

In the main process, handle these IPC channels. Use `safeStorage.encryptString()` and `safeStorage.decryptString()` for credential values.

## Settings Page (Settings.tsx)

The Settings page has these sections:

### 1. חשבון ישראכרט (Isracard Account)
Fields: מספר תעודת זהות (ID number), סיסמה (password)
Note below: "הסיסמה מוצפנת ונשמרת מקומית בלבד. לא נשלח לשרת חיצוני."

### 2. בנק יהב (Bank Yahav)  
Fields: Check israeli-bank-scrapers source for exact fields. Likely: שם משתמש (username), סיסמה (password). May also need מספר זהות (ID).

### 3. יעד עצמאות פיננסית (FI Target)
Field: יעד חיסכון (₪) — number input
Helper text: "לפי כלל 4%, יעד זה יאפשר הוצאות שנתיות של ₪X" (computed dynamically)

### 4. תצוגה וסנכרון (Display & Sync)
- מצב לילה toggle (dark mode)
- תדירות סנכרון אוטומטי dropdown (כל יום, כל שבוע, ידני)

### 5. שמירה
Button: "שמירת הגדרות" — saves everything, shows success toast

## Font Setup (globals.css)

```css
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url('../../../assets/fonts/NotoSansHebrew-Light.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../../../assets/fonts/NotoSansHebrew-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('../../../assets/fonts/NotoSansHebrew-Medium.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('../../../assets/fonts/NotoSansHebrew-SemiBold.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('../../../assets/fonts/NotoSansHebrew-Bold.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('../../../assets/fonts/NotoSansHebrew-ExtraBold.woff2') format('woff2');
}

html {
  direction: rtl;
}

body {
  font-family: 'Noto Sans Hebrew', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}
```

Download the font files from: https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew
Place .woff2 files in `assets/fonts/`.

## Color Palette

### Light Theme (default)
```css
:root[data-theme="light"] {
  --bg-primary: #f4f2ee;
  --bg-surface: #ffffff;
  --border: rgba(0,0,0,0.06);
  --text-primary: #1c1917;
  --text-secondary: #44403c;
  --text-muted: #78716c;
  --text-faint: #a8a29e;
  --green: #0d9488;
  --yellow: #b45309;
  --red: #e11d48;
  --accent: #4338ca;
}
```

### Dark Theme
```css
:root[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-surface: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.07);
  --text-primary: #f5f5f4;
  --text-secondary: #d6d3d1;
  --text-muted: #a8a29e;
  --text-faint: #78716c;
  --green: #2dd4bf;
  --yellow: #fbbf24;
  --red: #fb7185;
  --accent: #818cf8;
}
```

## Definition of Done
- [ ] `npm start` launches the Electron app with no blank screen
- [ ] Sidebar shows all navigation items in Hebrew
- [ ] Clicking navigation items switches pages (placeholders OK for non-Settings pages)
- [ ] Settings page renders with all form fields
- [ ] Saving credentials encrypts them via safeStorage
- [ ] SQLite database is created at `~/.finance-hub/finance.db`
- [ ] Default categories exist in the database
- [ ] Light theme is default, dark mode toggle works
- [ ] Font renders correctly (Noto Sans Hebrew, bundled locally)
- [ ] No console errors (warnings about CSP in dev mode are OK)
