import { useState, useRef, useEffect } from 'react'
import type React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie, Sector,
} from 'recharts'
import { BarChart2, Tag, List, Settings, FilePlus, Wallet, ChevronLeft, Upload, Moon, Sun, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Logo } from './Logo'
import { ChatWidget } from './ChatWidget'
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
import { useCardLayout } from '../hooks/useCardLayout'
import type { CardLayout } from '../hooks/useCardLayout'
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
import { BalanceChart } from './BalanceChart'
import type { BalancePoint } from './BalanceChart'
import { SpendingTrendsCard } from './SpendingTrendsCard'
import { ResizeHandle } from './ResizeHandle'

type Tab = 'insights' | 'mapping' | 'transactions' | 'cashflow' | 'settings'
type SpendFilter = 'all' | 'variable' | 'recurring'

const DEFAULT_INSIGHTS_LAYOUT: CardLayout[] = [
  { id: 'categories', colSpan: 2 },
  { id: 'monthly', colSpan: 2 },
  { id: 'trends', colSpan: 2 },
  { id: 'savings', colSpan: 2 },
  { id: 'budget', colSpan: 4 },
]

const DEFAULT_CASHFLOW_LAYOUT: CardLayout[] = [
  { id: 'cf-creditcard', colSpan: 1 },
  { id: 'cf-balancechart', colSpan: 3 },
  { id: 'cf-timeline', colSpan: 4 },
]

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
  const { accounts, addAccount, updateAccount, deleteAccount, savingsGoal, setSavingsGoal } = useSavings()
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

  // --- Dark mode ---
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('finance-hub-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('finance-hub-theme', dark ? 'dark' : 'light')
  }, [dark])

  // --- Sidebar collapsed state ---
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('finance-hub-sidebar') === 'collapsed'
  })
  useEffect(() => {
    localStorage.setItem('finance-hub-sidebar', sidebarCollapsed ? 'collapsed' : 'expanded')
  }, [sidebarCollapsed])

  const manualExpenses = manualEntries.filter((e) => e.type === 'expense')
  const manualIncome = manualEntries.filter((e) => e.type === 'income')
  const {
    filteredTransactions,
    allTransactions,
    activeFilterCount,
    updateFilters,
  } = useFilters()

  const [tab, setTab] = useState<Tab>('insights')
  const [spendFilter, setSpendFilter] = useState<SpendFilter>('all')
  const [budgetAdding, setBudgetAdding] = useState(false)
  const [selectedParent, setSelectedParent] = useState<string | null>(null)
  const [hoveredCatIdx, setHoveredCatIdx] = useState<number | null>(null)

  // --- Projection date range ---
  const [projDateFrom, setProjDateFrom] = useState('')
  const [projDateTo, setProjDateTo] = useState('')

  // --- Layout hooks for insights and cash flow ---
  const insights = useCardLayout('finance-hub-insights-layout', DEFAULT_INSIGHTS_LAYOUT)
  const cashflow = useCardLayout('finance-hub-cashflow-layout', DEFAULT_CASHFLOW_LAYOUT)
  const insightsGridRef = useRef<HTMLDivElement>(null)
  const cashflowGridRef = useRef<HTMLDivElement>(null)

  // Track which card is hovered (for resize handle visibility)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

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

    if (uncatAmount > 0) catChartData.push({ id: '_uncat', name: 'לא ממופה', icon: 'Package', amount: uncatAmount, color: '#c4c7ce' })
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

  const sidebarWidth = sidebarCollapsed ? 64 : 220

  return (
    <div style={s.page}>
      <div style={s.bodyWrap}>
        {/* ── Sidebar ── */}
        <nav style={{ ...s.sidebar, width: sidebarWidth }}>
          {/* Logo */}
          <div style={s.sidebarHeader}>
            <Logo size={36} />
          </div>

          {/* Nav items */}
          <div style={s.sidebarNav}>
            {([
              ['insights',     <BarChart2 size={20} strokeWidth={1.75} />, 'תובנות'],
              ['cashflow',     <Wallet size={20} strokeWidth={1.75} />, 'תזרים מזומנים'],
              ['mapping',      <Tag size={20} strokeWidth={1.75} />, 'מיפוי קטגוריות'],
              ['transactions', <List size={20} strokeWidth={1.75} />, 'כל העסקאות'],
              ['settings',     <Settings size={20} strokeWidth={1.75} />, 'הגדרות'],
            ] as [Tab, React.ReactNode, string][]).map(([id, icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{ ...s.navItem, ...(tab === id ? s.navItemActive : {}) }}
                title={sidebarCollapsed ? label : undefined}
              >
                <span style={s.navIcon}>{icon}</span>
                {!sidebarCollapsed && <span style={s.navLabel}>{label}</span>}
              </button>
            ))}
          </div>

          {/* Bottom actions */}
          <div style={s.sidebarFooter}>
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
            <button
              style={s.addFilesBtn}
              onClick={() => addFilesRef.current?.click()}
              title={sidebarCollapsed ? 'הוסף קבצים' : undefined}
            >
              <FilePlus size={18} strokeWidth={1.75} />
              {!sidebarCollapsed && <span>הוסף קבצים</span>}
            </button>
            <button
              style={s.sidebarActionBtn}
              onClick={() => setDark((d) => !d)}
              title={sidebarCollapsed ? (dark ? 'מצב בהיר' : 'מצב כהה') : (dark ? 'מצב בהיר' : 'מצב כהה')}
            >
              {dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
              {!sidebarCollapsed && <span>{dark ? 'מצב בהיר' : 'מצב כהה'}</span>}
            </button>
            <button
              style={s.collapseBtn}
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
            >
              {sidebarCollapsed
                ? <PanelRightOpen size={18} strokeWidth={1.75} />
                : <PanelRightClose size={18} strokeWidth={1.75} />
              }
            </button>
          </div>
        </nav>

        {/* ── Main content ── */}
        <div style={{ ...s.mainArea, marginRight: sidebarWidth }}>
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
            <FilterBar
              spendFilter={spendFilter}
              setSpendFilter={setSpendFilter}
              recurringTotal={recurringTotal}
              variableTotal={variableTotal}
              total={total}
            />

            {/* Draggable insight cards in 4-column grid */}
            <div ref={insightsGridRef} style={{ ...s.insightGrid, gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {insights.layout.map(({ id: cardId }) => {
                const colSpan = (insights.layout.find((c) => c.id === cardId)?.colSpan ?? 1) as 1 | 2 | 3 | 4
                const isDragging = insights.draggedCard === cardId
                const isOver = insights.dropTarget === cardId && insights.draggedCard !== cardId
                const wrapStyle: React.CSSProperties = {
                  ...s.card,
                  position: 'relative',
                  gridColumn: `span ${colSpan}`,
                  cursor: 'grab',
                  opacity: isDragging ? 0.5 : 1,
                  outline: isOver ? '2px dashed var(--accent)' : 'none',
                  outlineOffset: -2,
                  transition: 'opacity 0.15s, outline 0.15s',
                }
                const dragProps = {
                  draggable: true,
                  'data-card-wrapper': true,
                  onDragStart: insights.handleDragStart(cardId),
                  onDragEnd: insights.handleDragEnd,
                  onDragOver: insights.handleDragOver(cardId),
                  onDragLeave: insights.handleDragLeave,
                  onDrop: insights.handleDrop(cardId),
                  onMouseEnter: () => setHoveredCard(cardId),
                  onMouseLeave: () => setHoveredCard(null),
                }
                const resizeHandles = (
                  <>
                    <ResizeHandle side="left" cardId={cardId} currentSpan={colSpan} gridRef={insightsGridRef} onResize={insights.updateSpan} visible={hoveredCard === cardId} />
                    <ResizeHandle side="right" cardId={cardId} currentSpan={colSpan} gridRef={insightsGridRef} onResize={insights.updateSpan} visible={hoveredCard === cardId} />
                  </>
                )

                if (cardId === 'categories') return (
                  <div key={cardId} style={wrapStyle} {...dragProps}>
                    {resizeHandles}
                    <h2 style={s.cardTitle}>
                      <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
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
                                {catChartData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.[0]) return null
                                  const entry = payload[0]
                                  return (
                                    <div style={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{entry.name}</div>
                                      <div style={{ fontWeight: 600 }}>{fmt(entry.value as number)}</div>
                                    </div>
                                  )
                                }}
                                wrapperStyle={{ zIndex: 10 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
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
                )

                if (cardId === 'monthly') return (
                  <div key={cardId} style={wrapStyle} {...dragProps}>
                    {resizeHandles}
                    <h2 style={s.cardTitle}>
                      <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
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
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            formatter={(v: number, name: string) => {
                              if (name === '_uncat') return [fmt(v), 'לא ממופה']
                              const cat = getCategoryById(name, categories)
                              return [fmt(v), cat ? cat.name : name]
                            }}
                            contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13, background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
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
                          {monthChartData.some((d) => d['_uncat']) && <Bar dataKey="_uncat" stackId="s" fill="#c4c7ce" maxBarSize={60} />}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )

                if (cardId === 'trends') return (
                  <div key={cardId} style={wrapStyle} {...dragProps}>
                    {resizeHandles}
                    <h2 style={s.cardTitle}>
                      <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
                      מגמות הוצאות
                      <HelpTooltip text="מגמות הוצאות לפי קטגוריה לאורך זמן. ניתן להחליף בין ערכים חודשיים לממוצע נע (3 חודשים) וללחוץ על קטגוריה במקרא כדי להסתיר/להציג אותה" />
                    </h2>
                    <SpendingTrendsCard
                      monthlyData={monthChartData as { month: string; [categoryId: string]: number | string }[]}
                      categories={activeParentCats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))}
                    />
                  </div>
                )

                if (cardId === 'savings') return (
                  <div key={cardId} style={wrapStyle} {...dragProps}>
                    {resizeHandles}
                    <h2 style={s.cardTitle}>
                      <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
                      חסכונות
                      <HelpTooltip text="מעקב אחר חשבונות חיסכון, קופות גמל, קרנות השתלמות ועוד. הוסף חשבונות ועדכן יתרות כדי לראות את התמונה הכוללת" />
                      <button style={s.addInlineBtn} onClick={addAccount}>+ הוסף חיסכון</button>
                    </h2>
                    <SavingsCard accounts={accounts} onUpdate={updateAccount} onDelete={deleteAccount} savingsGoal={savingsGoal} onSetGoal={setSavingsGoal} />
                  </div>
                )

                if (cardId === 'budget') return (
                  <div key={cardId} style={wrapStyle} {...dragProps}>
                    {resizeHandles}
                    <h2 style={s.cardTitle}>
                      <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
                      תקציב חודשי
                      <HelpTooltip text="הגדר תקציב חודשי לכל קטגוריה ועקוב אחר ההוצאות בפועל מול היעד. כולל הוצאות כרטיס אשראי והוצאות ידניות קבועות" />
                      <button style={s.addInlineBtn} onClick={() => setBudgetAdding(true)}>+ הוסף תקציב</button>
                    </h2>
                    <BudgetCard budgets={budgets} setBudget={setBudget} removeBudget={removeBudget} map={map} manualExpenses={manualExpenses} manualIncome={manualIncome} bankEntries={bankEntries} adding={budgetAdding} setAdding={setBudgetAdding} />
                  </div>
                )

                return null
              })}
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

          // Projection date range
          const projTo = projDateTo ? new Date(projDateTo + 'T23:59:59') : (() => {
            const d = new Date(); d.setMonth(d.getMonth() + 1); return d
          })()
          const projFrom = projDateFrom ? new Date(projDateFrom + 'T00:00:00') : new Date()
          const derivedProjectionMonths = Math.max(1, Math.ceil(
            (projTo.getTime() - new Date().getTime()) / (30.44 * 24 * 60 * 60 * 1000)
          ))

          // Projected balance: current + expected entries in range + recurring projected within range
          const expectedEntries = allBankEntries.filter((e) => e.status === 'expected')
          const expectedInRange = expectedEntries.filter((e) => e.date >= projFrom && e.date <= projTo)
          const expectedNet = expectedInRange.reduce((s, e) => s + e.receipt - e.payment, 0)
          let projectedBalance = currentBalance + expectedNet
          const recurringEntries = allBankEntries.filter((e) => e.recurring)
          const today = new Date()
          for (const entry of recurringEntries) {
            const dayOfMonth = entry.date.getDate()
            for (let m = 0; m <= derivedProjectionMonths; m++) {
              const targetMonth = today.getMonth() + m
              const targetYear = today.getFullYear() + Math.floor(targetMonth / 12)
              const normalizedMonth = ((targetMonth % 12) + 12) % 12
              const daysInM = new Date(targetYear, normalizedMonth + 1, 0).getDate()
              const day = Math.min(dayOfMonth, daysInM)
              const projDate = new Date(targetYear, normalizedMonth, day)
              if (projDate < projFrom || projDate > projTo) continue
              const mk = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`
              const exists = allBankEntries.some(
                (e) => e.vendor === entry.vendor &&
                  `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}` === mk &&
                  !e.id.startsWith('proj_')
              )
              if (!exists) {
                projectedBalance += entry.receipt - entry.payment
              }
            }
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
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>
                    יתרה נוכחית
                    <HelpTooltip text="יתרת פתיחה בתוספת כל התנועות בסטטוס ״בפועל״ — תקבולות פחות תשלומים" />
                  </span>
                  <span style={{ display: 'block', fontSize: 32, fontWeight: 700, color: currentBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(currentBalance)}</span>
                </div>
                <div style={{ ...s.card, textAlign: 'center', padding: '28px 24px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>
                    יתרה צפויה
                    <HelpTooltip text="היתרה הנוכחית בתוספת כל התנועות הצפויות ותנועות קבועות בטווח התאריכים שנבחר. ברירת מחדל: חודש קדימה" />
                  </span>
                  <span style={{ display: 'block', fontSize: 32, fontWeight: 700, color: projectedBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(projectedBalance)}</span>
                </div>
                <div style={{ ...s.card, textAlign: 'center', padding: '28px 24px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>
                    תזרים חודשי ממוצע
                    <HelpTooltip text="ממוצע ההפרש בין תקבולות לתשלומים בכל חודש — מספר חיובי מראה שנכנס יותר ממה שיוצא" />
                  </span>
                  <span style={{
                    display: 'block', fontSize: 32, fontWeight: 700,
                    color: avgMonthlyNet >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {avgMonthlyNet >= 0 ? '+' : ''}{fmt(avgMonthlyNet)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                    על בסיס {realMonthNets.length} חודשים
                  </span>
                </div>
              </div>

              {/* Settings row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', direction: 'rtl', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '10px 16px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  יתרת פתיחה:
                  <input
                    type="number"
                    value={bankSettings.startingBalance}
                    onChange={(e) => updateBankSettings({ startingBalance: parseFloat(e.target.value) || 0 })}
                    style={{ ...s.cfInput, width: 100 }}
                  />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  תחזית:
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                    מ-
                    <input type="date" value={projDateFrom} onChange={(e) => setProjDateFrom(e.target.value)} style={s.cfInput} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                    עד
                    <input type="date" value={projDateTo} onChange={(e) => setProjDateTo(e.target.value)} style={s.cfInput} />
                  </label>
                  <span style={{ borderRight: '1px solid var(--border)', height: 18, margin: '0 2px' }} />
                  {[1, 2, 3].map((m) => {
                    const target = new Date()
                    target.setMonth(target.getMonth() + m)
                    const iso = target.toISOString().slice(0, 10)
                    const isActive = projDateTo === iso && !projDateFrom
                    return (
                      <button
                        key={m}
                        style={{
                          padding: '3px 8px',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: isActive ? 'var(--accent-fill)' : 'var(--bg-primary)',
                          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                          fontSize: 11,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap' as const,
                          fontWeight: isActive ? 700 : 400,
                          ...(isActive ? { borderColor: 'var(--accent)' } : {}),
                        }}
                        onClick={() => { setProjDateFrom(''); setProjDateTo(isActive ? '' : iso) }}
                      >
                        {m === 1 ? 'חודש' : `${m} חודשים`}
                      </button>
                    )
                  })}
                </div>
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8,
                    background: (projDateFrom || projDateTo) ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-primary)',
                    color: (projDateFrom || projDateTo) ? 'var(--red)' : 'var(--text-faint)',
                    fontSize: 12, fontFamily: 'inherit',
                    cursor: (projDateFrom || projDateTo) ? 'pointer' : 'not-allowed',
                    marginRight: 'auto',
                    ...((projDateFrom || projDateTo) ? { borderColor: 'var(--red)' } : {}),
                  }}
                  disabled={!projDateFrom && !projDateTo}
                  onClick={() => { setProjDateFrom(''); setProjDateTo('') }}
                >
                  איפוס
                </button>
              </div>

              {/* Cash flow managed cards in 4-column grid */}
              <div ref={cashflowGridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                {cashflow.layout.map(({ id: cfCardId }) => {
                  const cfColSpan = (cashflow.layout.find((c) => c.id === cfCardId)?.colSpan ?? 1) as 1 | 2 | 3 | 4
                  const cfIsDragging = cashflow.draggedCard === cfCardId
                  const cfIsOver = cashflow.dropTarget === cfCardId && cashflow.draggedCard !== cfCardId
                  const cfWrapStyle: React.CSSProperties = {
                    ...s.card,
                    position: 'relative',
                    gridColumn: `span ${cfColSpan}`,
                    cursor: 'grab',
                    opacity: cfIsDragging ? 0.5 : 1,
                    outline: cfIsOver ? '2px dashed var(--accent)' : 'none',
                    outlineOffset: -2,
                    transition: 'opacity 0.15s, outline 0.15s',
                  }
                  const cfDragProps = {
                    draggable: true,
                    'data-card-wrapper': true,
                    onDragStart: cashflow.handleDragStart(cfCardId),
                    onDragEnd: cashflow.handleDragEnd,
                    onDragOver: cashflow.handleDragOver(cfCardId),
                    onDragLeave: cashflow.handleDragLeave,
                    onDrop: cashflow.handleDrop(cfCardId),
                    onMouseEnter: () => setHoveredCard(cfCardId),
                    onMouseLeave: () => setHoveredCard(null),
                  }
                  const cfResizeHandles = (
                    <>
                      <ResizeHandle side="left" cardId={cfCardId} currentSpan={cfColSpan} gridRef={cashflowGridRef} onResize={cashflow.updateSpan} visible={hoveredCard === cfCardId} />
                      <ResizeHandle side="right" cardId={cfCardId} currentSpan={cfColSpan} gridRef={cashflowGridRef} onResize={cashflow.updateSpan} visible={hoveredCard === cfCardId} />
                    </>
                  )

                  if (cfCardId === 'cf-creditcard') return (
                    <div key={cfCardId} style={cfWrapStyle} {...cfDragProps}>
                      {cfResizeHandles}
                      <CreditCardBox
                        payments={ccPayments}
                        onAdd={addCcPayment}
                        onUpdate={updateCcPayment}
                        onDelete={deleteCcPayment}
                      />
                    </div>
                  )

                  if (cfCardId === 'cf-balancechart') return (() => {
                    // Build sorted entries with running balance for the chart
                    const sorted = [...allBankEntries].sort((a, b) => a.date.getTime() - b.date.getTime())

                    // Also generate projections for recurring entries (same logic as CashFlowTimeline)
                    const projEntries: typeof sorted = []
                    const recurringForProj = allBankEntries.filter((e) => e.recurring)
                    const today = new Date()
                    for (const entry of recurringForProj) {
                      const dayOfMonth = entry.date.getDate()
                      for (let m = 0; m <= derivedProjectionMonths; m++) {
                        const targetMonth = today.getMonth() + m
                        const targetYear = today.getFullYear() + Math.floor(targetMonth / 12)
                        const normalizedMonth = ((targetMonth % 12) + 12) % 12
                        const daysInM = new Date(targetYear, normalizedMonth + 1, 0).getDate()
                        const day = Math.min(dayOfMonth, daysInM)
                        const projDate = new Date(targetYear, normalizedMonth, day)
                        const mk = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`
                        const exists = allBankEntries.some(
                          (e) => e.vendor === entry.vendor &&
                            `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}` === mk &&
                            !e.id.startsWith('proj_')
                        )
                        if (!exists) {
                          projEntries.push({ ...entry, id: `proj_${entry.id}_${m}`, date: projDate, status: projDate <= today ? 'actual' : 'expected', source: entry.source })
                        }
                      }
                    }

                    const allSorted = [...sorted, ...projEntries].sort((a, b) => a.date.getTime() - b.date.getTime())

                    const fromDate = projDateFrom ? new Date(projDateFrom + 'T00:00:00') : null
                    const toDate = projDateTo ? new Date(projDateTo + 'T23:59:59') : null

                    let balance = bankSettings.startingBalance
                    const chartData: BalancePoint[] = []
                    let minVal = Infinity
                    let minLabel = ''
                    let minSeries: 'actual' | 'proj' = 'actual'

                    for (const entry of allSorted) {
                      balance += entry.receipt - entry.payment
                      const entryTime = entry.date.getTime()

                      if (fromDate && entryTime < fromDate.getTime()) continue
                      if (toDate && entryTime > toDate.getTime()) continue

                      const isProj = entry.id.startsWith('proj_') || entry.status === 'expected'
                      const label = entry.date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
                      const dateStr = entry.date.toISOString().slice(0, 10)

                      const prev = chartData[chartData.length - 1]
                      if (prev && prev.date === dateStr) {
                        if (isProj) prev.proj = balance
                        else { prev.actual = balance; prev.proj = balance }
                      } else {
                        chartData.push({
                          label,
                          date: dateStr,
                          actual: isProj ? null : balance,
                          proj: isProj ? balance : balance,
                        })
                      }

                      if (balance < minVal) {
                        minVal = balance
                        minLabel = label
                        minSeries = isProj ? 'proj' : 'actual'
                      }
                    }

                    // Bridge: set proj on last actual point so the line connects
                    for (let i = 0; i < chartData.length - 1; i++) {
                      if (chartData[i].actual !== null && chartData[i + 1].actual === null && chartData[i].proj === null) {
                        chartData[i].proj = chartData[i].actual
                      }
                    }

                    return (
                      <div key={cfCardId} style={cfWrapStyle} {...cfDragProps}>
                        {cfResizeHandles}
                        <h2 style={s.cardTitle}>
                          <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
                          מסלול יתרה צפוי
                          <HelpTooltip text="גרף מסלול היתרה לאורך זמן — קו ירוק רציף מייצג תנועות בפועל, קו סגול מקווקו מייצג תחזית. הנקודה האדומה מסמנת את שפל היתרה" />
                        </h2>
                        {chartData.length > 0 ? (
                          <BalanceChart
                            data={chartData}
                            minBalanceLabel={minVal < Infinity ? minLabel : undefined}
                            minBalanceValue={minVal < Infinity ? minVal : undefined}
                            minBalanceSeries={minSeries}
                          />
                        ) : (
                          <p style={s.empty}>אין נתונים להצגה.</p>
                        )}
                      </div>
                    )
                  })()

                  if (cfCardId === 'cf-timeline') return (
                    <div key={cfCardId} style={cfWrapStyle} {...cfDragProps}>
                      {cfResizeHandles}
                      <h2 style={s.cardTitle}>
                        <span style={s.dragHandle} title="גרור לשינוי סדר">⠿</span>
                        תזרים מזומנים
                        <HelpTooltip text="טבלת כל התנועות בחשבון — תשלומים, תקבולות ויתרה מצטברת. סמן תנועה כקבועה כדי להקרין אותה לחודשים הבאים" />
                        <span style={s.cardSub}>{allBankEntries.length} רשומות</span>
                        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
                          <button
                            style={s.cfImportBtn}
                            onClick={() => bankFileRef.current?.click()}
                          >
                            <Upload size={14} strokeWidth={1.75} /> ייבוא דוח בנק
                          </button>
                          <button
                            style={s.cfAddRowBtn}
                            onClick={() => addBankEntry({ date: new Date(), source: 'manual', status: 'expected' })}
                          >
                            + הוסף שורה
                          </button>
                        </div>
                      </h2>
                      <CashFlowTimeline
                        entries={allBankEntries}
                        startingBalance={bankSettings.startingBalance}
                        projectionMonths={derivedProjectionMonths}
                        projectionEndDate={projTo}
                        onUpdateEntry={updateBankEntry}
                        onDeleteEntry={deleteBankEntry}
                      />
                    </div>
                  )

                  return null
                })}
              </div>

            </>
          )
        })()}

        {/* ─ SETTINGS ─ */}
        {tab === 'settings' && (
          <SettingsTab
            allTransactions={allTransactions}
            map={map}
            setMapping={setMapping}
            onClearAll={onClearAll}
          />
        )}
      </div>
        </div>{/* end mainArea */}
        <ChatWidget
          hasData={allTransactions.length > 0}
          allTransactions={allTransactions}
          filteredTransactions={filteredTransactions}
          map={map}
          budgets={budgets}
          recurringMerchants={recurringMerchants}
          onNavigate={(t) => setTab(t as Tab)}
          onApplyFilter={(f) => updateFilters(f)}
        />
      </div>{/* end bodyWrap */}
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
      <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ ...s.sValue, fontSize: small ? '14px' : '22px', color: color ?? 'var(--text-primary)' }}>
          {value}
        </span>
        {note && <span style={{ fontSize: '11px', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{note}</span>}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const SIDEBAR_TRANSITION = 'width 0.2s ease, margin-right 0.2s ease'

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '18px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', transition: 'font-size 0.2s ease, width 0.2s ease' },
  bodyWrap: { display: 'flex', flex: 1, position: 'relative', direction: 'rtl' },
  sidebar: { position: 'fixed', top: 0, right: 0, height: '100vh', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 30, transition: SIDEBAR_TRANSITION, overflow: 'hidden' },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px 16px 12px', borderBottom: '1px solid var(--border)', minHeight: 56, direction: 'rtl' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px 10px', flex: 1 },
  sidebarFooter: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px 12px', borderTop: '1px solid var(--border)' },
  addFilesBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s ease', whiteSpace: 'nowrap', direction: 'rtl', overflow: 'hidden', width: '100%' },
  sidebarActionBtn: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap', direction: 'rtl', overflow: 'hidden' },
  navItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap', direction: 'rtl', overflow: 'hidden' },
  navItemActive: { background: 'var(--accent-fill)', color: 'var(--accent)', fontWeight: 600 },
  navIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 20, height: 20 },
  navLabel: { overflow: 'hidden', textOverflow: 'ellipsis' },
  collapseBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'inherit' },
  mainArea: { flex: 1, display: 'flex', flexDirection: 'column', transition: SIDEBAR_TRANSITION, paddingBottom: 48, minWidth: 0 },
  summaryBar: { display: 'flex', gap: '16px', padding: '20px 28px', flexWrap: 'wrap', direction: 'rtl' },
  sCard: { flex: '1 1 140px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' },
  sLabel: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.01em' },
  sValue: { fontWeight: 700 },
  content: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 28px 0' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', direction: 'rtl' },
  filterGroup: { display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '3px', border: '1px solid var(--border)' },
  filterBtn: { padding: '7px 16px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s ease', fontWeight: 500 },
  filterActive: { background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600, boxShadow: 'var(--shadow-sm)' },
  splitSummary: { fontSize: '13px', color: 'var(--text-secondary)', direction: 'rtl' },
  insightGrid: { display: 'grid', gap: '20px' },
  dragHandle: { cursor: 'grab', color: 'var(--text-faint)', fontSize: 16, lineHeight: 1, userSelect: 'none' as const, flexShrink: 0, opacity: 0.6, transition: 'opacity 0.15s' },
  cardRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  card: { flex: '1 1 0', minWidth: 0, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' },
  cardTitle: { margin: '0 0 20px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', letterSpacing: '-0.01em' },
  cardSub: { fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' },
  addInlineBtn: { marginRight: 'auto', padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: '#fff', fontWeight: 600, transition: 'opacity 0.15s ease' },
  empty: { color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 },
  metricBox: { flex: '1 1 140px', textAlign: 'center' as const, padding: '16px 12px' },
  metricLabel: { display: 'block', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 },
  metricValue: { display: 'block', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' },
  cfInput: { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', direction: 'rtl', outline: 'none', transition: 'border-color 0.15s ease' },
  cfImportBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 'auto', transition: 'opacity 0.15s ease' },
  cfAddRowBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s ease' },
}
