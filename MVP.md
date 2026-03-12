# Finance Hub MVP — Credit Card CSV Analyzer

## What We're Building
A local web app that runs in your browser. You export a CSV from Isracard's website, drop it into the app, and get spending insights instantly. No APIs, no accounts, no backend servers.

## Tech Stack
- **React + TypeScript** (Vite for fast setup, not Webpack)
- **Papaparse** for CSV parsing
- **Recharts** for charts
- Runs locally via `npm run dev` → opens in browser

That's it. No Electron, no database, no Node backend.

---

## Step 1: Project Setup

Create a new Vite + React + TypeScript project:
```bash
cd C:\Users\yakij\Projects
npm create vite@latest finance-hub -- --template react-ts
cd finance-hub
npm install
npm install papaparse recharts
npm install -D @types/papaparse
```

Verify it works:
```bash
npm run dev
```
Opens in browser at localhost:5173. You should see the Vite + React starter page.

---

## Step 2: Understand the CSV Format

Before coding, we need to know what Isracard's CSV export looks like.

**Action for user:** Export a CSV from Isracard's website and share the first few rows (with amounts, not personal data) so we know the column names and format.

**Typical Isracard CSV structure** (may vary — we'll adjust):
```
תאריך עסקה, שם בית העסק, קטגוריה, סכום חיוב, מטבע, סכום עסקה מקורי, מטבע מקורי, פירוט נוסף
01/01/2026, שופרסל, מזון, 245.00, ₪, 245.00, ₪, 
02/01/2026, סונול, דלק, 220.00, ₪, 220.00, ₪,
```

The app should handle whatever columns exist. We'll map them in Step 4.

---

## Step 3: File Upload Component

Create `src/components/FileUpload.tsx`:

**Requirements:**
- Full-page drop zone when no data is loaded
- Drag & drop: drag a CSV onto the page → highlights drop zone → parses on drop
- File picker: "בחר קובץ" button as alternative
- Accept only .csv files
- Show file name after successful upload
- Hebrew UI, RTL direction
- If file is invalid or empty, show error: "הקובץ אינו תקין. נסה לייצא מחדש מישראכרט."

**Visual design:**
- Centered on page with dashed border
- Icon: 📄 or upload icon
- Main text: "גרור קובץ CSV לכאן"
- Subtitle: "או לחץ לבחירת קובץ"
- When dragging over: border becomes solid, background changes slightly

---

## Step 4: CSV Parser

Create `src/utils/parseCSV.ts`:

**Requirements:**
- Use Papaparse to parse the CSV
- Auto-detect Hebrew column names
- Map columns to a standard Transaction type:

```typescript
interface Transaction {
  date: Date;
  merchant: string;       // שם בית העסק
  category: string;       // קטגוריה (from Isracard's own categorization)
  amount: number;         // סכום חיוב (always positive number, these are expenses)
  originalAmount?: number; // סכום עסקה מקורי (if in foreign currency)
  currency?: string;      // מטבע
  notes?: string;         // פירוט נוסף
}
```

- Handle encoding: Isracard CSVs may be UTF-8 or Windows-1255. Try UTF-8 first, fall back to Windows-1255.
- Skip header rows (Isracard sometimes has metadata rows before the actual headers)
- Filter out empty rows
- Parse dates from DD/MM/YYYY format to Date objects
- Parse amounts: remove commas and currency symbols, convert to number

---

## Step 5: Data Dashboard

Create `src/components/Dashboard.tsx`:

This is the main view after CSV is loaded. Three insight cards:

### Card 1: הוצאות לפי קטגוריה (Monthly Spending by Category)
- Horizontal bar chart or donut chart
- Each category from the CSV with total spend
- Sorted by amount (highest first)
- Show ₪ amount next to each bar
- Use distinct colors per category

### Card 2: מגמת הוצאות (Month-over-Month Trend)
- Line chart showing total monthly spending over time
- X axis: months (ינו׳, פבר׳, מרץ...)
- Y axis: total ₪ spent
- If CSV has multiple months, show the trend
- If only one month, show weekly breakdown instead

### Card 3: דפוס הוצאות (Daily/Weekly Spending Pattern)
- Bar chart showing spending by day of week
- Sunday (ראשון) through Saturday (שבת)
- Shows which days you spend the most
- Average spend per day of week

### Summary Bar (above cards):
- Total transactions: X עסקאות
- Total spending: ₪XX,XXX
- Date range: MM/YYYY — MM/YYYY
- Average transaction: ₪XXX

---

## Step 6: App Shell & Styling

Create the overall layout in `src/App.tsx`:

**Structure:**
```
┌──────────────────────────────────┐
│  Finance Hub          [חדש 📄]  │  ← Header with "upload new file" button
├──────────────────────────────────┤
│                                  │
│   Summary bar                    │
│                                  │
│   ┌─────────┐  ┌─────────┐     │
│   │Category │  │ Trend   │     │
│   │  Chart  │  │  Chart  │     │
│   └─────────┘  └─────────┘     │
│                                  │
│   ┌──────────────────────┐      │
│   │  Daily Pattern Chart │      │
│   └──────────────────────┘      │
│                                  │
│   Transaction Table (below)      │
│                                  │
└──────────────────────────────────┘
```

**Styling:**
- Font: Noto Sans Hebrew from Google Fonts (via CDN — fine for a web app, no CSP issues)
- Direction: RTL
- Background: #f4f2ee (warm stone)
- Cards: white, rounded corners (16px), subtle shadow
- Color palette: same as our dashboard prototype
  - Green: #0d9488
  - Red: #e11d48
  - Accent: #4338ca
  - Amber: #b45309
- Responsive: works on any screen size

---

## Step 7: Transaction Table

Below the charts, show a searchable/sortable table of all transactions:

| תאריך | בית עסק | קטגוריה | סכום |
|--------|---------|---------|------|

- Sortable by clicking column headers
- Searchable: text input that filters by merchant name
- Amount formatted as ₪X,XXX
- Date formatted as DD.MM.YY
- Alternating row colors for readability

---

## How to Build This with Claude Code

Save this file as `MVP.md` in your project folder. Then in Claude Code:

### Session 1: Setup + File Upload
```
Read MVP.md. Start with Steps 1-3. Create the Vite project, install dependencies, 
and build the file upload component with drag & drop and file picker. 
Hebrew UI, RTL. Make sure npm run dev works and I can see the upload page.
```

### Session 2: CSV Parsing
```
Read MVP.md Step 4. Build the CSV parser. I'll paste sample rows from my 
Isracard CSV export so you can see the actual format and map columns correctly.
```

### Session 3: Dashboard Charts
```
Read MVP.md Steps 5-6. Build the three insight charts and the summary bar.
Use Recharts. Make it look clean with our color palette.
```

### Session 4: Transaction Table + Polish
```
Read MVP.md Step 7. Add the transaction table below the charts. 
Add sorting and search. Final polish on styling.
```

---

## Tips for Each Session
- Start each session with `/clear` or restart `claude` for a fresh context
- Use `/compact` after Claude Code finishes a big chunk of work
- Switch to Sonnet model (`/model`) to save tokens
- One focused task per session — don't mix steps
- Test after each session: `npm run dev` and check the browser

---

## Later Enhancements (not now)
These are future ideas. Do NOT build these yet:
- [ ] Multiple CSV uploads (compare months)
- [ ] Custom category mapping (override Isracard's categories)
- [ ] Budget setting per category
- [ ] Export insights as PDF
- [ ] Bank account CSV import
- [ ] Save data between sessions (localStorage or SQLite)
- [ ] Electron wrapper for desktop app
- [ ] API integration for auto-import
