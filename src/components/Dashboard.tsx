import { useState, useRef } from 'react'
import type React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie, Sector,
} from 'recharts'
import { BarChart2, Tag, List, Settings, FilePlus, Wallet, ChevronLeft, Upload } from 'lucide-react'
import type { Transaction, BankEntry } from '../types'
import { getCategoryById, getChildCategories, getParentCategories } from '../categories'
import { CategoryIcon } from '../icons'
import { FilterProvider, useFilters } from '../context/FilterContext'
import { useCategories } from '../context/CategoriesContext'
import { useSavings } from '../hooks/useSavings'
import { useBudgets } from '../hooks/useBudgets'
import { useManualEntries } from '../hooks/useManualEntries'
import { useBankEntries } from '../hooks/useBankEntries'
import { useCreditCardPayments } from '../hooks/useCreditCardPayments'
import { parseBankExcel } from '../utils/parseFile'
import { FilterBar } from './FilterBar'
import { MerchantMapper } from './MerchantMapper'
import { TransactionTable } from './TransactionTable'
import { HelpTooltip } from './HelpTooltip'
import { SettingsTab } from './SettingsTab'
import { SavingsCard } from './SavingsCard'
import { BudgetCard } from './BudgetCard'
import { CashFlowTimeline } from './CashFlowTimeline'
import { CreditCardBox } from './CreditCardBox'

type Tab = 'insights' | 'mapping' | 'transactions' | 'cashflow' | 'settings'
type SpendFilter = 'all' | 'variable' | 'recurring'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function isRecurring(tx: Transaction, recurringMerchants: Set<string>): boolean {
  const autoDetected = tx.notes === 'הוראת קבע' || (tx.notes?.includes('תשלום') ?? false)
  const inSet = recurringMerchants.has(tx.merchant)
  // For auto-detected: inSet means user excluded it. For manual: inSet means user included it.
  return autoDetected ? !inSet : inSet
}

// ---------------------------------------------------------------------------
// Public entry point — mounts the FilterProvider
// ---------------------------------------------------------------------------
interface DashboardProps {
  transactions: Transaction[]
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
  onAddFiles: (files: File[]) => void
  onClearAll: () => void
  recurringMerchants: Set<string>
  toggleRecurring: (merchant: string) => void
}

export function Dashboard({ transactions, map, setMapping, onAddFiles, onClearAll, recurringMerchants, toggleRecurring }: DashboardProps) {
  return (
    <FilterProvider transactions={transactions} map={map}>
      <DashboardContent map={map} setMapping={setMapping} onAddFiles={onAddFiles} onClearAll={onClearAll} recurringMerchants={recurringMerchants} toggleRecurring={toggleRecurring} />
    </FilterProvider>
  )
}

// ---------------------------------------------------------------------------
// Inner content — consumes FilterContext
// ---------------------------------------------------------------------------
function DashboardContent({
  map,
  setMapping,
  onAddFiles,
  onClearAll,
  recurringMerchants,
  toggleRecurring,
}: {
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
  onAddFiles: (files: File[]) => void
  onClearAll: () => void
  recurringMerchants: Set<string>
  toggleRecurring: (merchant: string) => void
}) {
  const { categories } = useCategories()
  const { accounts, addAccount, updateAccount, deleteAccount } = useSavings()
  const { budgets, setBudget, removeBudget } = useBudgets()
  const { entries: manualEntries } = useManualEntries()
  const {
    entries: bankEntries,
    settings: bankSettings,
    addEntry: addBankEntry,
    updateEntry: updateBankEntry,
    deleteEntry: deleteBankEntry,
    importEntries: importBankEntries,
    updateSettings: updateBankSettings,
  } = useBankEntries()
  const {
    payments: ccPayments,
    addPayment: addCcPayment,
    updatePayment: updateCcPayment,
    deletePayment: deleteCcPayment,
  } = useCreditCardPayments()
  const addFilesRef = useRef<HTMLInputElement>(null)
  const bankFileRef = useRef<HTMLInputElement>(null)

  const manualExpenses = manualEntries.filter((e) => e.type === 'expense')
  const manualIncome = manualEntries.filter((e) => e.type === 'income')
  const {
    filteredTransactions,
    allTransactions,
    activeFilterCount,
  } = useFilters()

  const [tab, setTab] = useState<Tab>('insights')
  const [spendFilter, setSpendFilter] = useState<SpendFilter>('all')
  const [budgetAdding, setBudgetAdding] = useState(false)
  const [selectedParent, setSelectedParent] = useState<string | null>(null)
  const [hoveredCatIdx, setHoveredCatIdx] = useState<number | null>(null)

  // --- Summary stats (from filteredTransactions) ---
  const total = filteredTransactions.reduce((s, t) => s + t.amount, 0)
  const sortedDates = [...filteredTransactions].sort((a, b) => a.date.getTime() - b.date.getTime())
  const earliest = sortedDates[0]?.date
  const latest = sortedDates[sortedDates.length - 1]?.date

  const allTotal = allTransactions.reduce((s, t) => s + t.amount, 0)

  // --- Insights tab: apply SpendFilter on top of global filter ---
  const insightsTxs =
    spendFilter === 'all'
      ? filteredTransactions
      : spendFilter === 'recurring'
      ? filteredTransactions.filter((t) => isRecurring(t, recurringMerchants))
      : filteredTransactions.filter((t) => !isRecurring(t, recurringMerchants))

  const insightsTotal = insightsTxs.reduce((s, t) => s + t.amount, 0)
  const recurringTotal = filteredTransactions.filter((t) => isRecurring(t, recurringMerchants)).reduce((s, t) => s + t.amount, 0)
  const variableTotal = total - recurringTotal

  // --- Chart 1: by category (aggregate at parent level) ---
  // Helper: compute per-category raw amounts (before manual merging)
  const rawCatAmounts: Record<string, number> = {}
  for (const cat of categories) {
    rawCatAmounts[cat.id] = Math.round(insightsTxs.filter((t) => map[t.merchant] === cat.id).reduce((s, t) => s + t.amount, 0))
  }

  // Merge recurring manual expenses into raw amounts
  let manualUncatAmount = 0
  for (const me of manualExpenses.filter((e) => e.recurring)) {
    if (me.category) {
      rawCatAmounts[me.category] = (rawCatAmounts[me.category] ?? 0) + Math.round(me.amount)
    } else {
      manualUncatAmount += me.amount
    }
  }

  const uncatAmount = Math.round(insightsTxs.filter((t) => !map[t.merchant]).reduce((s, t) => s + t.amount, 0) + manualUncatAmount)

  // Build chart data depending on drill-down state
  let catChartData: { id: string; name: string; icon: string; amount: number; color: string }[]

  if (selectedParent) {
    // Drill-down: show sub-categories of selected parent
    const children = getChildCategories(selectedParent, categories)
    const parentCat = categories.find((c) => c.id === selectedParent)
    catChartData = []
    // Show parent's own transactions (not via children)
    const parentOwn = rawCatAmounts[selectedParent] ?? 0
    if (parentOwn > 0 && children.length > 0 && parentCat) {
      catChartData.push({ id: selectedParent, name: parentCat.name + ' (כללי)', icon: parentCat.icon, amount: parentOwn, color: parentCat.color })
    }
    for (const child of children) {
      const amt = rawCatAmounts[child.id] ?? 0
      if (amt > 0) catChartData.push({ id: child.id, name: child.name, icon: child.icon, amount: amt, color: child.color })
    }
    // If no children and only parent, show parent
    if (catChartData.length === 0 && parentCat && parentOwn > 0) {
      catChartData.push({ id: selectedParent, name: parentCat.name, icon: parentCat.icon, amount: parentOwn, color: parentCat.color })
    }
  } else {
    // Top-level: aggregate children into parents
    const parents = getParentCategories(categories)
    catChartData = parents.map((parent) => {
      let amount = rawCatAmounts[parent.id] ?? 0
      for (const child of getChildCategories(parent.id, categories)) {
        amount += rawCatAmounts[child.id] ?? 0
      }
      return { id: parent.id, name: parent.name, icon: parent.icon, amount, color: parent.color }
    }).filter((d) => d.amount > 0)

    if (uncatAmount > 0) catChartData.push({ id: '_uncat', name: 'לא ממופה', icon: 'Package', amount: uncatAmount, color: '#c8c3d8' })
  }

  catChartData.sort((a, b) => b.amount - a.amount)

  // --- Chart 2: month-over-month ---
  const monthGroups = insightsTxs.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
    ;(acc[key] = acc[key] ?? []).push(tx)
    return acc
  }, {})

  // Build per-category totals from recurring manual expenses for monthly chart
  const recurringManualByCategory: Record<string, number> = {}
  for (const me of manualExpenses.filter((e) => e.recurring)) {
    const catId = me.category ?? '_uncat'
    recurringManualByCategory[catId] = (recurringManualByCategory[catId] ?? 0) + Math.round(me.amount)
  }

  // Use only parent categories for the monthly chart
  const parentCats = getParentCategories(categories)
  const activeParentCats = parentCats.filter((parent) => {
    const childIds = getChildCategories(parent.id, categories).map((c) => c.id)
    const allIds = [parent.id, ...childIds]
    const hasTx = insightsTxs.some((t) => allIds.includes(map[t.merchant]))
    const hasManual = allIds.some((id) => recurringManualByCategory[id])
    return hasTx || hasManual
  })

  const monthChartData = Object.keys(monthGroups).sort().map((key) => {
    const [y, m] = key.split('-')
    const entry: Record<string, unknown> = { month: `${HEBREW_MONTHS[parseInt(m) - 1]} '${y.slice(2)}` }
    for (const parent of activeParentCats) {
      const childIds = getChildCategories(parent.id, categories).map((c) => c.id)
      const allIds = [parent.id, ...childIds]
      const txAmount = Math.round(monthGroups[key].filter((t) => allIds.includes(map[t.merchant])).reduce((s, t) => s + t.amount, 0))
      const manualAmount = allIds.reduce((s, id) => s + (recurringManualByCategory[id] ?? 0), 0)
      const total = txAmount + manualAmount
      if (total > 0) entry[parent.id] = total
    }
    const uncat = Math.round(monthGroups[key].filter((t) => !map[t.merchant]).reduce((s, t) => s + t.amount, 0)) + (recurringManualByCategory['_uncat'] ?? 0)
    if (uncat > 0) entry['_uncat'] = uncat
    return entry
  })

  const dateRange =
    earliest && latest
      ? `${earliest.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${latest.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
      : '—'

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <span style={s.logo}>Finance Hub</span>
        <nav style={s.tabs}>
          {([
            ['insights',     <BarChart2 size={14} strokeWidth={1.75} />, 'תובנות'],
            ['mapping',      <Tag size={14} strokeWidth={1.75} />, 'מיפוי קטגוריות'],
            ['transactions', <List size={14} strokeWidth={1.75} />, 'כל העסקאות'],
            ['cashflow',     <Wallet size={14} strokeWidth={1.75} />, 'תזרים מזומנים'],
            ['settings',     <Settings size={14} strokeWidth={1.75} />, 'הגדרות'],
          ] as [Tab, React.ReactNode, string][]).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{ ...s.tabBtn, ...(tab === id ? s.tabActive : {}) }}
            >
              {icon}{label}
            </button>
          ))}
        </nav>
        <input
          ref={addFilesRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 0) onAddFiles(Array.from(files))
            e.target.value = ''
          }}
        />
        <button style={s.newBtn} onClick={() => addFilesRef.current?.click()}>
          <FilePlus size={14} strokeWidth={1.75} />הוסף קבצים
        </button>
      </header>

      {/* ── Summary bar (insights only) ── */}
      {tab === 'insights' && <div style={s.summaryBar}>
        <SCard
          label="טווח תאריכים"
          value={dateRange}
          small
          tooltip="תאריך העסקה הראשונה והאחרונה בנתונים המסוננים"
        />
        <SCard
          label="סה״כ הוצאות"
          value={fmt(total)}
          tooltip="סך כל החיובים בכרטיס האשראי לפי הסינון הנוכחי"
          note={activeFilterCount > 0 ? `מתוך ${fmt(allTotal)} בסה״כ` : undefined}
        />
      </div>}

      {/* ── Tab content ── */}
      <div style={s.content}>

        {/* ─ INSIGHTS ─ */}
        {tab === 'insights' && (
          <>
            <FilterBar />

            {/* Split filter */}
            <div style={s.filterRow}>
              <div style={s.filterGroup}>
                {([
                  ['all', 'הכל'],
                  ['variable', 'הוצאות משתנות'],
                  ['recurring', 'הוצאות קבועות'],
                ] as [SpendFilter, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSpendFilter(id)}
                    style={{ ...s.filterBtn, ...(spendFilter === id ? s.filterActive : {}) }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {spendFilter !== 'all' && (
                <div style={s.splitSummary}>
                  <span>קבועות: {fmt(recurringTotal)} ({total > 0 ? Math.round(recurringTotal / total * 100) : 0}%)</span>
                  <span style={{ margin: '0 10px', color: 'var(--border)' }}>|</span>
                  <span>משתנות: {fmt(variableTotal)} ({total > 0 ? Math.round(variableTotal / total * 100) : 0}%)</span>
                </div>
              )}
            </div>

            {/* Row 1: Chart 1 + Chart 2 side by side */}
            <div style={s.cardRow}>
              <div style={s.card}>
                <h2 style={s.cardTitle}>
                  {selectedParent ? (() => {
                    const p = categories.find((c) => c.id === selectedParent)
                    return p ? `${p.name} — פירוט` : 'פירוט'
                  })() : 'הוצאות לפי קטגוריה'}
                  <HelpTooltip text="סך ההוצאות בכל קטגוריה, מגבוה לנמוך. 'לא ממופה' הוא בתי עסק שטרם שויכו לקטגוריה — עבור למיפוי כדי להשלים" />
                  <span style={s.cardSub}>{fmt(catChartData.reduce((s, d) => s + d.amount, 0))}</span>
                  {selectedParent && (
                    <button
                      style={{ ...s.addInlineBtn, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      onClick={() => setSelectedParent(null)}
                    >
                      חזור
                    </button>
                  )}
                </h2>
                {catChartData.length === 0 ? (
                  <p style={s.empty}>אין נתונים. מפה בתי עסק לקטגוריות בלשונית מיפוי.</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 32, direction: 'rtl', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '0 0 220px', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={catChartData}
                            dataKey="amount"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={98}
                            paddingAngle={2}
                            startAngle={90}
                            endAngle={-270}
                            style={{ cursor: !selectedParent ? 'pointer' : 'default' }}
                            activeIndex={hoveredCatIdx ?? undefined}
                            activeShape={(props: unknown) => {
                              const p = props as Record<string, unknown>
                              return <Sector {...p} outerRadius={(p.outerRadius as number) + 6} />
                            }}
                            onMouseEnter={(_data, idx) => setHoveredCatIdx(idx)}
                            onMouseLeave={() => setHoveredCatIdx(null)}
                            onClick={(_data, idx) => {
                              if (selectedParent) return
                              const entry = catChartData[idx]
                              if (!entry || entry.id === '_uncat') return
                              const children = getChildCategories(entry.id, categories)
                              if (children.length > 0) setSelectedParent(entry.id)
                            }}
                          >
                            {catChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [fmt(v), 'סכום']} contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>סה״כ</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(catChartData.reduce((s, d) => s + d.amount, 0))}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
                      {catChartData.map((d, i) => {
                        const hasDrillDown = !selectedParent && d.id !== '_uncat' && getChildCategories(d.id, categories).length > 0
                        return (
                          <div
                            key={i}
                            onMouseEnter={() => setHoveredCatIdx(i)}
                            onMouseLeave={() => setHoveredCatIdx(null)}
                            onClick={() => {
                              if (hasDrillDown) setSelectedParent(d.id)
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                              padding: '4px 6px', borderRadius: 6, transition: 'background 0.15s',
                              background: hoveredCatIdx === i ? d.color + '15' : 'transparent',
                              cursor: hasDrillDown ? 'pointer' : 'default',
                            }}
                          >
                            <div style={{ width: 11, height: 11, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                            <span style={{ color: d.color, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                              <CategoryIcon icon={d.icon} size={13} />
                            </span>
                            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(d.amount)}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 32, textAlign: 'left' }}>
                              {insightsTotal > 0 ? Math.round(d.amount / insightsTotal * 100) : 0}%
                            </span>
                            {hasDrillDown && (
                              <ChevronLeft size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={s.card}>
                <h2 style={s.cardTitle}>
                  השוואה חודשית
                  <HelpTooltip text="השוואת ההוצאות הכוללות בין החודשים, מחולקת לפי קטגוריות. שימושי לזיהוי חודשים חריגים או מגמות לאורך זמן" />
                </h2>
                {monthChartData.length === 0 ? (
                  <p style={s.empty}>אין נתונים לאחר סינון.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthChartData} margin={{ left: 20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'inherit' }} />
                      <YAxis width={55} tickFormatter={(v: number) => '₪' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        formatter={(v: number, name: string) => {
                          if (name === '_uncat') return [fmt(v), 'לא ממופה']
                          const cat = getCategoryById(name, categories)
                          return [fmt(v), cat ? cat.name : name]
                        }}
                        contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13 }}
                      />
                      <Legend content={({ payload }) => (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: 8, fontFamily: 'inherit', fontSize: 12, direction: 'rtl' }}>
                          {(payload ?? []).map((entry, i) => {
                            const label = entry.dataKey === '_uncat' ? 'לא ממופה' : (getCategoryById(String(entry.dataKey), categories)?.name ?? String(entry.dataKey))
                            return (
                              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: String(entry.color), flexShrink: 0 }} />
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      )} />
                      {activeParentCats.map((cat) => <Bar key={cat.id} dataKey={cat.id} stackId="s" fill={cat.color} maxBarSize={60} />)}
                      {monthChartData.some((d) => d['_uncat']) && <Bar dataKey="_uncat" stackId="s" fill="#c8c3d8" maxBarSize={60} />}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Row 2: savings + placeholder */}
            <div style={s.cardRow}>
              <div style={s.card}>
                <h2 style={s.cardTitle}>
                  חסכונות
                  <HelpTooltip text="מעקב אחר חשבונות חיסכון, קופות גמל, קרנות השתלמות ועוד. הוסף חשבונות ועדכן יתרות כדי לראות את התמונה הכוללת" />
                  <button style={s.addInlineBtn} onClick={addAccount}>+ הוסף חיסכון</button>
                </h2>
                <SavingsCard accounts={accounts} onUpdate={updateAccount} onDelete={deleteAccount} />
              </div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>
                  תקציב חודשי
                  <HelpTooltip text="הגדר תקציב חודשי לכל קטגוריה ועקוב אחר ההוצאות בפועל מול היעד. כולל הוצאות כרטיס אשראי והוצאות ידניות קבועות" />
                  <button style={s.addInlineBtn} onClick={() => setBudgetAdding(true)}>+ הוסף תקציב</button>
                </h2>
                <BudgetCard budgets={budgets} setBudget={setBudget} removeBudget={removeBudget} map={map} manualExpenses={manualExpenses} manualIncome={manualIncome} bankEntries={bankEntries} adding={budgetAdding} setAdding={setBudgetAdding} />
              </div>
            </div>


          </>
        )}

        {/* ─ MAPPING ─ */}
        {tab === 'mapping' && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>
              מיפוי בתי עסק לקטגוריות
              <HelpTooltip text="שייך כל בית עסק לקטגוריה. הרשימה ממוינת לפי סכום הוצאה — התחל מהגדולים להשפעה הרבה ביותר על התובנות. המיפוי נשמר אוטומטית" />
            </h2>
            <MerchantMapper transactions={allTransactions} map={map} setMapping={setMapping} />
          </div>
        )}

        {/* ─ TRANSACTIONS ─ */}
        {tab === 'transactions' && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>
              כל העסקאות
              <HelpTooltip text="רשימת כל העסקאות. ניתן לשנות קטגוריה לכל עסקה — השינוי יחול על כל העסקאות מאותו בית עסק" />
              <span style={s.cardSub}>{filteredTransactions.length} עסקאות{activeFilterCount > 0 ? ` (מסוננות מתוך ${allTransactions.length})` : ''}</span>
            </h2>
            <FilterBar />
            <div style={{ marginTop: 16 }}>
              <TransactionTable map={map} setMapping={setMapping} recurringMerchants={recurringMerchants} toggleRecurring={toggleRecurring} />
            </div>
          </div>
        )}

        {/* ─ CASH FLOW ─ */}
        {tab === 'cashflow' && (() => {
          // Convert credit card payments to BankEntry format
          const ccAsBankEntries: BankEntry[] = ccPayments.map((cc) => ({
            id: `cc_${cc.id}`,
            date: cc.date,
            status: 'expected' as const,
            category: 'כרטיס אשראי',
            vendor: 'כרטיס אשראי',
            payment: cc.amount,
            receipt: 0,
            recurring: false,
            source: 'manual' as const,
          }))

          const allBankEntries = [...bankEntries, ...ccAsBankEntries]

          // Current balance: only actual (בפועל) transactions
          const actualEntries = allBankEntries.filter((e) => e.status === 'actual')
          const actualPayments = actualEntries.reduce((s, e) => s + e.payment, 0)
          const actualReceipts = actualEntries.reduce((s, e) => s + e.receipt, 0)
          const currentBalance = bankSettings.startingBalance + actualReceipts - actualPayments

          // Projected balance: current + all expected entries + recurring projected forward
          const expectedEntries = allBankEntries.filter((e) => e.status === 'expected')
          const expectedNet = expectedEntries.reduce((s, e) => s + e.receipt - e.payment, 0)
          let projectedBalance = currentBalance + expectedNet
          const recurringEntries = allBankEntries.filter((e) => e.recurring)
          for (const e of recurringEntries) {
            projectedBalance += e.receipt - e.payment
          }

          // --- Net monthly stats (from all entries including cc) ---
          const monthNets: Record<string, number> = {}
          for (const e of allBankEntries) {
            const mk = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`
            monthNets[mk] = (monthNets[mk] ?? 0) + e.receipt - e.payment
          }
          const realMonthNets = Object.values(monthNets)
          const avgMonthlyNet = realMonthNets.length > 0
            ? Math.round(realMonthNets.reduce((s, n) => s + n, 0) / realMonthNets.length)
            : 0

          async function handleBankImport(e: React.ChangeEvent<HTMLInputElement>) {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const buffer = await file.arrayBuffer()
              const result = parseBankExcel(buffer)
              if (result.entries.length === 0) {
                alert('לא זוהו נתונים בפורמט בנק. ודא שהקובץ מכיל כותרות מתאימות.')
                return
              }
              importBankEntries(result.entries)
              if (result.startingBalance !== undefined) {
                updateBankSettings({ startingBalance: result.startingBalance })
              }
            } catch (err) {
              console.error('Bank import error:', err)
              alert('שגיאה בייבוא קובץ הבנק.')
            }
            e.target.value = ''
          }

          return (
            <>
              <input
                ref={bankFileRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleBankImport}
              />

              {/* Summary metrics */}
              <div style={s.cardRow}>
                <div style={{ ...s.card, textAlign: 'center', padding: '28px 24px' }}>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>יתרה נוכחית</span>
                  <span style={{ display: 'block', fontSize: 32, fontWeight: 700, color: currentBalance >= 0 ? '#0d9488' : '#e11d48' }}>{fmt(currentBalance)}</span>
                </div>
                <div style={{ ...s.card, textAlign: 'center', padding: '28px 24px' }}>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>יתרה צפויה (חודש קדימה)</span>
                  <span style={{ display: 'block', fontSize: 32, fontWeight: 700, color: projectedBalance >= 0 ? '#0d9488' : '#e11d48' }}>{fmt(projectedBalance)}</span>
                </div>
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
              </div>

              {/* Settings row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', direction: 'rtl' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  יתרת פתיחה:
                  <input
                    type="number"
                    value={bankSettings.startingBalance}
                    onChange={(e) => updateBankSettings({ startingBalance: parseFloat(e.target.value) || 0 })}
                    style={{ ...s.cfInput, width: 100 }}
                  />
                </label>
              </div>

              {/* Credit card payment box */}
              <CreditCardBox
                payments={ccPayments}
                onAdd={addCcPayment}
                onUpdate={updateCcPayment}
                onDelete={deleteCcPayment}
              />

              {/* Cash flow timeline */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>
                  תזרים מזומנים
                  <span style={s.cardSub}>{allBankEntries.length} רשומות</span>
                  <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
                    <button
                      style={s.cfImportBtn}
                      onClick={() => bankFileRef.current?.click()}
                    >
                      <Upload size={14} strokeWidth={1.75} /> ייבוא דוח בנק
                    </button>
                    <button
                      style={s.cfImportBtn}
                      onClick={() => addBankEntry({ date: new Date(), source: 'manual', status: 'expected' })}
                    >
                      + הוסף שורה
                    </button>
                  </div>
                </h2>
                <CashFlowTimeline
                  entries={allBankEntries}
                  startingBalance={bankSettings.startingBalance}
                  projectionMonths={1}
                  onUpdateEntry={updateBankEntry}
                  onDeleteEntry={deleteBankEntry}
                />
              </div>

            </>
          )
        })()}

        {/* ─ SETTINGS ─ */}
        {tab === 'settings' && (
          <div style={s.card}>
            <h2 style={{ ...s.cardTitle, marginBottom: 24 }}>הגדרות</h2>
            <SettingsTab
              allTransactions={allTransactions}
              map={map}
              setMapping={setMapping}
              onClearAll={onClearAll}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SCard({ label, value, small, color, tooltip, note }: {
  label: string; value: string; small?: boolean; color?: string; tooltip?: string; note?: string
}) {
  return (
    <div style={s.sCard}>
      <span style={{ ...s.sLabel, display: 'flex', alignItems: 'center', gap: '5px' }}>
        {label}
        {tooltip && <HelpTooltip text={tooltip} />}
      </span>
      <span style={{ ...s.sValue, fontSize: small ? '14px' : '22px', color: color ?? 'var(--text-primary)' }}>
        {value}
      </span>
      {note && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{note}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 48 },
  header: { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', direction: 'rtl', flexWrap: 'wrap' },
  logo: { fontSize: '18px', fontWeight: 700, color: 'var(--accent)', marginLeft: 'auto' },
  tabs: { display: 'flex', gap: '4px' },
  tabBtn: { padding: '6px 14px', border: 'none', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
  tabActive: { background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 700 },
  newBtn: { padding: '6px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px' },
  summaryBar: { display: 'flex', gap: '16px', padding: '16px 24px', flexWrap: 'wrap', direction: 'rtl' },
  sCard: { flex: '1 1 140px', background: 'var(--bg-surface)', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sLabel: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 },
  sValue: { fontWeight: 700 },
  content: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 24px 0' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', direction: 'rtl' },
  filterGroup: { display: 'flex', gap: '4px', background: 'var(--bg-surface)', borderRadius: '10px', padding: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterBtn: { padding: '6px 14px', border: '1px solid transparent', borderRadius: '7px', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
  filterActive: { background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 700, border: '1px solid var(--border)' },
  splitSummary: { fontSize: '13px', color: 'var(--text-secondary)', direction: 'rtl' },
  cardRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  card: { flex: '1 1 0', minWidth: 0, background: 'var(--bg-surface)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  cardSub: { fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' },
  addInlineBtn: { marginRight: 'auto', padding: '4px 12px', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: '#fff', fontWeight: 600 },
  empty: { color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0', margin: 0 },
  metricBox: { flex: '1 1 140px', textAlign: 'center' as const, padding: '16px 12px' },
  metricLabel: { display: 'block', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6 },
  metricValue: { display: 'block', fontSize: 24, fontWeight: 700 },
  cfInput: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', direction: 'rtl', outline: 'none' },
  cfImportBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 'auto' },
}
