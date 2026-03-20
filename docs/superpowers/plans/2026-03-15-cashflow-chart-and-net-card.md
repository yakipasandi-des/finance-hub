# Cash Flow Balance Chart & Net Monthly Card — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a running-balance line chart (past + projected) and a net monthly cash flow summary card to the cash flow tab.

**Architecture:** Both features consume the same data already computed in `Dashboard.tsx`'s cashflow tab (bank entries, projections, running balance). The chart groups entries by month and plots cumulative balance as an area/line chart. The net card computes average monthly net from real entries. No new hooks, types, or data sources needed — purely presentational additions to the existing cashflow tab.

**Tech Stack:** React, TypeScript, Recharts (already installed — `AreaChart`, `Area`, `Line`, `ReferenceLine`), existing CSS-in-JS pattern.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/BalanceChart.tsx` | **Create** | Area chart showing running balance over time with projected zone shaded differently |
| `src/components/Dashboard.tsx` | **Modify** (lines ~534-648, cashflow tab) | Compute chart data, add net card, render `BalanceChart` |

No new types, hooks, or utilities needed.

---

## Chunk 1: Balance Chart Component

### Task 1: Create BalanceChart component

**Files:**
- Create: `src/components/BalanceChart.tsx`

**Data shape the component receives:**

```ts
interface BalancePoint {
  label: string       // e.g. "מרץ '26"
  balance: number     // cumulative balance at end of month
  projected: boolean  // true if month is entirely projections
}
```

The parent (Dashboard) builds this array. The component just renders it.

- [ ] **Step 1: Create the BalanceChart component**

Create `src/components/BalanceChart.tsx` with this implementation:

```tsx
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

export interface BalancePoint {
  label: string
  // Split series: one for actual, one for projected
  actual: number | null
  proj: number | null
}

interface BalanceChartProps {
  data: BalancePoint[]
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export function BalanceChart({ data }: BalanceChartProps) {
  if (data.length === 0) return <p style={s.empty}>אין נתונים להצגה.</p>

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'inherit' }}
        />
        <YAxis
          tickFormatter={(v: number) => '₪' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
        />
        <Tooltip
          formatter={(v: number) => [fmt(v), 'יתרה']}
          contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13 }}
        />
        <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
        <Area
          dataKey="actual"
          stroke="#0d9488"
          fill="#0d948825"
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 3, fill: '#0d9488' }}
          name="בפועל"
        />
        <Area
          dataKey="proj"
          stroke="#4338ca"
          fill="#4338ca15"
          strokeWidth={2}
          strokeDasharray="6 3"
          connectNulls={false}
          dot={{ r: 3, fill: '#4338ca' }}
          name="תחזית"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const s: Record<string, React.CSSProperties> = {
  empty: {
    color: 'var(--text-muted)',
    fontSize: 14,
    textAlign: 'center',
    padding: '24px 0',
    margin: 0,
  },
}
```

**Design decisions:**
- Two `<Area>` series: `actual` (solid green) and `proj` (dashed accent/purple). They overlap at the transition month so the line is continuous.
- `ReferenceLine` at y=0 so the user instantly sees when balance crosses negative.
- Uses `connectNulls={false}` — actual points are `null` for projected months and vice versa, except the overlap point.
- Same Tooltip/axis styling as the existing monthly bar chart in Dashboard.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (component is created but not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add src/components/BalanceChart.tsx
git commit -m "feat: add BalanceChart component for cash flow page"
```

---

## Chunk 2: Wire chart + net card into Dashboard

### Task 2: Compute chart data and add net monthly card

**Files:**
- Modify: `src/components/Dashboard.tsx` (cashflow tab, ~lines 534-648)

The cashflow tab already computes `currentBalance`, `projectedBalance`, and has access to all `bankEntries` + `bankSettings`. We need to:

1. Build the `BalancePoint[]` array from entries + projections
2. Compute net monthly cash flow stats
3. Render both the chart and the net card

- [ ] **Step 1: Add import**

At the top of `Dashboard.tsx`, alongside the existing `CashFlowTimeline` import, add:

```tsx
import { BalanceChart } from './BalanceChart'
import type { BalancePoint } from './BalanceChart'
```

- [ ] **Step 2: Build chart data inside the cashflow tab**

Inside the `tab === 'cashflow'` IIFE (after the existing `projectedBalance` computation, before `handleBankImport`), add:

```tsx
// --- Balance chart data ---
// Merge real entries with projections, group by month, compute end-of-month balance
// (HEBREW_MONTHS is already defined at file top, line 30)

// Re-use CashFlowTimeline's projection logic inline (same algorithm)
const allCfEntries = [...bankEntries]
const cfRecurring = bankEntries.filter((e) => e.recurring)
const today = new Date()
for (const re of cfRecurring) {
  const dayOfMonth = re.date.getDate()
  for (let m = 1; m <= bankSettings.projectionMonths; m++) {
    const targetMonth = today.getMonth() + m
    const targetYear = today.getFullYear() + Math.floor(targetMonth / 12)
    const normalizedMonth = ((targetMonth % 12) + 12) % 12
    const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
    const day = Math.min(dayOfMonth, maxDay)
    const projDate = new Date(targetYear, normalizedMonth, day)
    const exists = bankEntries.some(
      (e) => e.vendor === re.vendor && e.date.getTime() === projDate.getTime()
    )
    if (!exists) {
      allCfEntries.push({ ...re, id: `proj_${re.id}_${m}`, date: projDate, status: 'expected' })
    }
  }
}
allCfEntries.sort((a, b) => a.date.getTime() - b.date.getTime())

// Group by month and compute end-of-month balances
const monthBuckets: Record<string, { net: number; hasReal: boolean }> = {}
for (const e of allCfEntries) {
  const mk = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`
  if (!monthBuckets[mk]) monthBuckets[mk] = { net: 0, hasReal: false }
  monthBuckets[mk].net += e.receipt - e.payment
  if (!e.id.startsWith('proj_')) monthBuckets[mk].hasReal = true
}

let cumBalance = bankSettings.startingBalance
const balanceChartData: BalancePoint[] = Object.keys(monthBuckets).sort().map((mk) => {
  const [y, m] = mk.split('-')
  const bucket = monthBuckets[mk]
  cumBalance += bucket.net
  const isProjected = !bucket.hasReal
  return {
    label: `${HEBREW_MONTHS[parseInt(m) - 1]} '${y.slice(2)}`,
    actual: !isProjected ? cumBalance : null,
    proj: isProjected ? cumBalance : null,
  }
})

// Bridge: the last actual point should also appear in proj so lines connect
for (let i = 0; i < balanceChartData.length; i++) {
  if (balanceChartData[i].proj !== null && i > 0 && balanceChartData[i - 1].actual !== null) {
    balanceChartData[i - 1].proj = balanceChartData[i - 1].actual
  }
}

// --- Net monthly stats ---
// Only from real entries, grouped by month
const realMonthNets: number[] = Object.keys(monthBuckets)
  .filter((mk) => monthBuckets[mk].hasReal)
  .map((mk) => monthBuckets[mk].net)
const avgMonthlyNet = realMonthNets.length > 0
  ? Math.round(realMonthNets.reduce((s, n) => s + n, 0) / realMonthNets.length)
  : 0
```

**Key notes:**
- We duplicate the projection logic from `CashFlowTimeline.generateProjections` rather than extracting it, because extracting would change the component's interface for no gain beyond this one use. If a third consumer appears, then extract.
- `hasReal` tracks whether a month has any non-projected entries, used to split the chart series.
- The "bridge" loop ensures the line visually connects where actual ends and projected begins.

- [ ] **Step 3: Add the net monthly card**

In the summary metrics `cardRow` (the one with "יתרה נוכחית" and "יתרה צפויה"), add a third card after the existing two:

```tsx
<div style={{ ...s.card, textAlign: 'center', padding: '28px 24px' }}>
  <span style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>
    תזרים חודשי ממוצע
  </span>
  <span style={{
    display: 'block', fontSize: 32, fontWeight: 700,
    color: avgMonthlyNet >= 0 ? '#0d9488' : '#e11d48',
  }}>
    {avgMonthlyNet >= 0 ? '+' : ''}{fmt(avgMonthlyNet)}
  </span>
  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
    על בסיס {realMonthNets.length} חודשים
  </span>
</div>
```

This tells the user: "on average, you gain/lose X per month", based on actual data only (not projections).

- [ ] **Step 4: Render the BalanceChart**

Add a new card between the settings row and the timeline card:

```tsx
<div style={s.card}>
  <h2 style={s.cardTitle}>מגמת יתרה</h2>
  <BalanceChart data={balanceChartData} />
</div>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: add balance trend chart and net monthly card to cash flow tab"
```

---

## Verification Checklist

After both tasks:

1. `npm run build` passes
2. Cash flow tab shows three summary cards: יתרה נוכחית, יתרה צפויה, תזרים חודשי ממוצע
3. Balance chart shows a green solid line for months with real data, transitioning to a dashed purple line for projected months
4. A horizontal dashed line at y=0 is visible
5. Hovering chart points shows the balance in ₪
6. With no bank entries: chart shows "אין נתונים להצגה", net card shows ₪0
7. Adding/removing entries updates both chart and net card in real time
