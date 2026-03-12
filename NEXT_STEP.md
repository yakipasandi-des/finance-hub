# Next Step: Category Mapping + Monthly Comparison

## Context
The app currently parses Isracard .xlsx files and shows transactions grouped by merchant. 
We need to add the ability to assign merchants to categories, then show insights by category.

---

## Feature 1: Category Mapping

### Default Categories
Add these built-in categories (user can add more later):

```typescript
const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'מזון וסופר', icon: '🛒', color: '#0d9488' },
  { id: 'dining', name: 'מסעדות ואוכל בחוץ', icon: '🍽️', color: '#b45309' },
  { id: 'transport', name: 'תחבורה ודלק', icon: '🚗', color: '#7c3aed' },
  { id: 'housing', name: 'דיור', icon: '🏠', color: '#4338ca' },
  { id: 'health', name: 'בריאות וביטוח', icon: '🏥', color: '#e11d48' },
  { id: 'shopping', name: 'קניות', icon: '🛍️', color: '#d946ef' },
  { id: 'subscriptions', name: 'מנויים וחשבונות', icon: '📱', color: '#0ea5e9' },
  { id: 'kids', name: 'ילדים וחינוך', icon: '👶', color: '#f59e0b' },
  { id: 'entertainment', name: 'בילויים ופנאי', icon: '🎬', color: '#ec4899' },
  { id: 'other', name: 'אחר', icon: '📦', color: '#78716c' },
];
```

### Merchant-to-Category Mapping
Store mappings in memory (later we can add localStorage):

```typescript
// Key: merchant name (exact or normalized), Value: category id
type MerchantCategoryMap = Record<string, string>;

// Example:
{
  "מיני זול משואה-צמרת": "groceries",
  "סופר פארם ישראל בע\"מ": "groceries",
  "הראל-ביטוח בריאות": "health",
  "הראל חיים": "health",
}
```

### Auto-Suggest Logic
Before the user maps anything, try to auto-suggest categories based on keyword matching:

```typescript
const AUTO_SUGGEST_RULES = [
  // Groceries
  { patterns: ['מיני זול', 'שופרסל', 'רמי לוי', 'סופר', 'מרקט', 'יוחננוף', 'ויקטורי', 'חצי חינם', 'אושר עד'], category: 'groceries' },
  // Dining
  { patterns: ['מסעדה', 'פיצה', 'מקדונלד', 'ברגר', 'קפה', 'בית קפה', 'wolt', 'תן ביס', 'מילק'], category: 'dining' },
  // Transport
  { patterns: ['דלק', 'סונול', 'פז', 'דור אלון', 'אלון', 'ten', 'רכבת', 'אגד', 'דן', 'חניון', 'חנייה'], category: 'transport' },
  // Health & Insurance
  { patterns: ['הראל', 'ביטוח', 'מאוחדת', 'כללית', 'מכבי', 'לאומית', 'קופ"ח', 'קופת חולים', 'בית מרקחת', 'סופר פארם'], category: 'health' },
  // Kids & Education
  { patterns: ['העמותה העירוני', 'בית ספר', 'גן ילדים', 'צהרון', 'חוגים'], category: 'kids' },
  // Subscriptions
  { patterns: ['נטפליקס', 'ספוטיפי', 'אפל', 'גוגל', 'אמזון', 'סלקום', 'פרטנר', 'הוט', 'בזק', 'yes'], category: 'subscriptions' },
];
```

Match is case-insensitive and checks if the merchant name CONTAINS any pattern.
If matched → assign automatically but mark as "auto" (user can override).
If not matched → show as uncategorized.

### UI: Category Assignment

#### Option A: Inline on transaction table
Add a category column to the transaction table. Each cell shows:
- If categorized: colored chip with icon + category name
- If uncategorized: gray chip "ללא קטגוריה" with a subtle "+" or dropdown arrow

Clicking the chip opens a dropdown with all categories. Selecting one:
1. Assigns the category to THIS transaction
2. Maps the merchant to that category for ALL transactions with the same merchant name
3. All other transactions from the same merchant update instantly

#### Option B: Bulk mapping page (recommended to also build)
A separate view/modal showing all unique merchants, sorted by total spend:

```
┌──────────────────────────────────────────────────────┐
│  מיפוי בתי עסק לקטגוריות                              │
│                                                       │
│  🟢 מיני זול משואה-צמרת    ₪2,340  [🛒 מזון וסופר ▾] │
│  🟢 סופר פארם ישראל        ₪1,280  [🛒 מזון וסופר ▾] │
│  🟡 שומרה ביטוח             ₪2,065  [🏥 בריאות    ▾] │
│  ⚪ מירוש דיזיין            ₪5,500  [ללא קטגוריה  ▾] │
│  ⚪ מנטה אורה               ₪620    [ללא קטגוריה  ▾] │
│  ...                                                  │
└──────────────────────────────────────────────────────┘
🟢 = auto-mapped  🟡 = user-mapped  ⚪ = uncategorized
```

User can quickly go through the list and assign categories. 
Show total spend per merchant to help prioritize (map the big ones first).

### Persist Mappings
For now, use localStorage to remember merchant→category mappings between sessions:
```typescript
localStorage.setItem('merchantCategoryMap', JSON.stringify(map));
```
Load on startup and apply to new uploads automatically.

---

## Feature 2: Category-Based Charts

Once categories exist, UPDATE the existing charts:

### Chart 1: הוצאות לפי קטגוריה (replace merchant chart)
- Horizontal bar chart grouped by CATEGORY (not merchant)
- Each bar: category icon + name + total ₪ amount
- Sorted by spend (highest first)
- Use category colors
- Show percentage of total next to each bar

### Chart 2: השוואה חודשית (Month-over-Month)
- Grouped bar chart: one group per month, bars colored by category
- X axis: months from the uploaded files (e.g., ינואר, פברואר, מרץ)
- Y axis: ₪ amount
- Stacked bar variant option (toggle between grouped and stacked)
- Total spend line overlay on top
- Show month totals above each group

### Chart 3: דפוס הוצאות (Daily Pattern — keep existing)
- Keep the daily/weekly pattern chart as-is
- Minor improvement: color the bars by whether it's a weekday or weekend

---

## Feature 3: Recurring Detection

Use the "פירוט נוסף" column from the Excel to identify recurring charges:

```typescript
function isRecurring(transaction: Transaction): boolean {
  return transaction.notes === 'הוראת קבע' || 
         transaction.notes?.includes('תשלום') ||  // installments
         false;
}
```

### Split View
Add a toggle or tabs above the charts:
```
[הכל] [הוצאות משתנות] [הוצאות קבועות]
```

- **הכל**: all transactions (default)
- **הוצאות משתנות**: only non-recurring (discretionary spending)
- **הוצאות קבועות**: only recurring (standing orders + installments)

Show summary when the split is active:
```
הוצאות קבועות: ₪X,XXX (XX% מסה"כ)
הוצאות משתנות: ₪X,XXX (XX% מסה"כ)
```

---

## Updated Summary Bar

Update the top summary bar to show:
```
┌─────────────────────────────────────────────────────────┐
│  XX קטגוריות  │  X.2026 — X.2026  │  סה"כ ₪XX,XXX  │  XX% ממופה  │
└─────────────────────────────────────────────────────────┘
```

- Number of active categories (that have transactions)
- Date range
- Total spend
- Mapping coverage: what % of transaction ₪ is categorized (motivates user to map more)

---

## Navigation Update

Add a simple tab bar or button to switch between views:
```
[📊 תובנות]  [🏷️ מיפוי קטגוריות]  [📋 כל העסקאות]
```

- **תובנות**: the charts dashboard (default after upload)
- **מיפוי קטגוריות**: the bulk merchant mapping view
- **כל העסקאות**: the full transaction table

---

## Claude Code Prompt

Save this file as `NEXT_STEP.md` in the project folder. Tell Claude Code:

```
Read NEXT_STEP.md. Implement in this order:

1. First: Add the default categories and auto-suggest mapping logic.
   Apply auto-suggest to all existing parsed transactions.
   Store mappings in localStorage.

2. Second: Add the category column to the transaction table with 
   inline dropdown. When user picks a category, map ALL transactions 
   from that merchant.

3. Third: Build the bulk merchant mapping view.

4. Fourth: Update Chart 1 to group by category instead of merchant.
   Add Chart 2 (month-over-month comparison).

5. Fifth: Add the recurring detection and split view toggle.

Test after each step with npm run dev.
```

---

## Feature 4: Global Filter Bar

Add a filter bar that sits above all charts and the transaction table. Filters apply to EVERYTHING below — all charts update when filters change.

### Layout
```
┌────────────────────────────────────────────────────────────────┐
│  🔍 סינון:  [חודש ▾]  [קטגוריה ▾]  [טווח סכומים ━━●━━━━●━━]  │  [איפוס] │
└────────────────────────────────────────────────────────────────┘
```

### Filter 1: חודש (Month)
- Multi-select dropdown with all months found in the uploaded data
- Options: "ינואר 2026", "פברואר 2026", "מרץ 2026" (dynamic from data)
- Default: all months selected
- Show checkboxes per month so user can pick any combination
- When a single month is selected, the month-over-month chart adjusts to show weekly breakdown of that month instead

### Filter 2: קטגוריה (Category)
- Multi-select dropdown with all categories that have transactions
- Shows category icon + name + transaction count per category
- Default: all selected
- User can select/deselect individual categories
- "בחר הכל" / "נקה הכל" buttons at top of dropdown
- Uncategorized ("ללא קטגוריה") should also appear as a selectable option

### Filter 3: טווח סכומים (Amount Range)
- Dual-handle range slider
- Min: ₪0, Max: dynamic based on highest transaction in data
- Labels showing current selected range: "₪50 — ₪2,000"
- Default: full range (no filtering)
- Quick preset buttons below the slider:
  - "עד ₪100" (small purchases)
  - "₪100-500" (medium)
  - "מעל ₪500" (large)

### Filter Behavior
- All filters are AND logic (month AND category AND amount range)
- Charts, summary bar, and transaction table all update immediately when any filter changes
- Show active filter count: "3 מסננים פעילים" next to the reset button
- "איפוס" (Reset) button clears all filters back to defaults
- The summary bar totals should reflect the filtered data, not the full dataset
- Show a subtle note when filters are active: "מציג X מתוך Y עסקאות"

### Implementation Notes
- Create a FilterContext (React Context) that all components consume
- Filter state:
```typescript
interface Filters {
  months: string[];          // Selected months, e.g., ["2026-01", "2026-03"]
  categories: string[];      // Selected category IDs, empty = all
  amountMin: number;         // Minimum amount
  amountMax: number;         // Maximum amount
}
```
- Every chart and table component reads from FilterContext
- Changing any filter triggers re-render of all data components
- Filtered transactions are computed once and shared (don't filter separately per chart)

---

## Definition of Done
- [ ] Auto-suggest correctly maps common Israeli merchants to categories
- [ ] User can assign/change category per merchant via inline dropdown
- [ ] Bulk mapping view shows all merchants sorted by spend
- [ ] Mappings persist in localStorage across page refreshes
- [ ] Chart 1 shows spending by category (not merchant)
- [ ] Chart 2 shows month-over-month comparison (3 months)
- [ ] Recurring transactions are detected from "הוראת קבע" field
- [ ] Toggle between all / variable / fixed spending works
- [ ] Summary bar shows mapping coverage percentage
- [ ] Tab navigation between insights / mapping / transaction list works
- [ ] Global filter bar appears above charts
- [ ] Month filter: multi-select dropdown, all months from data
- [ ] Category filter: multi-select dropdown with icons and counts
- [ ] Amount range slider works with min/max and preset buttons
- [ ] All charts and table update when any filter changes
- [ ] Summary bar reflects filtered data
- [ ] "X מתוך Y עסקאות" indicator shows when filters are active
- [ ] Reset button clears all filters
