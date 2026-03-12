import { useState } from 'react'
import type React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie,
} from 'recharts'
import { BarChart2, Tag, List, Settings, FilePlus } from 'lucide-react'
import type { Transaction } from '../types'
import { getCategoryById } from '../categories'
import { CategoryIcon } from '../icons'
import { FilterProvider, useFilters } from '../context/FilterContext'
import { useCategories } from '../context/CategoriesContext'
import { useSavings } from '../hooks/useSavings'
import { FilterBar } from './FilterBar'
import { MerchantMapper } from './MerchantMapper'
import { TransactionTable } from './TransactionTable'
import { HelpTooltip } from './HelpTooltip'
import { SettingsTab } from './SettingsTab'
import { SavingsCard } from './SavingsCard'

type Tab = 'insights' | 'mapping' | 'transactions' | 'settings'
type SpendFilter = 'all' | 'variable' | 'recurring'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function isRecurring(tx: Transaction): boolean {
  return tx.notes === 'הוראת קבע' || (tx.notes?.includes('תשלום') ?? false)
}

// ---------------------------------------------------------------------------
// Public entry point — mounts the FilterProvider
// ---------------------------------------------------------------------------
interface DashboardProps {
  transactions: Transaction[]
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
  onReset: () => void
  onClearAll: () => void
}

export function Dashboard({ transactions, map, setMapping, onReset, onClearAll }: DashboardProps) {
  return (
    <FilterProvider transactions={transactions} map={map}>
      <DashboardContent map={map} setMapping={setMapping} onReset={onReset} onClearAll={onClearAll} />
    </FilterProvider>
  )
}

// ---------------------------------------------------------------------------
// Inner content — consumes FilterContext
// ---------------------------------------------------------------------------
function DashboardContent({
  map,
  setMapping,
  onReset,
  onClearAll,
}: {
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
  onReset: () => void
  onClearAll: () => void
}) {
  const { categories } = useCategories()
  const { accounts, addAccount, updateAccount, deleteAccount } = useSavings()
  const {
    filteredTransactions,
    allTransactions,
    activeFilterCount,
  } = useFilters()

  const [tab, setTab] = useState<Tab>('insights')
  const [spendFilter, setSpendFilter] = useState<SpendFilter>('all')

  // --- Summary stats (from filteredTransactions) ---
  const total = filteredTransactions.reduce((s, t) => s + t.amount, 0)
  const sortedDates = [...filteredTransactions].sort((a, b) => a.date.getTime() - b.date.getTime())
  const earliest = sortedDates[0]?.date
  const latest = sortedDates[sortedDates.length - 1]?.date

  const mappedTotal = allTransactions.filter((t) => map[t.merchant]).reduce((s, t) => s + t.amount, 0)
  const allTotal = allTransactions.reduce((s, t) => s + t.amount, 0)
  const coveragePct = allTotal > 0 ? Math.round((mappedTotal / allTotal) * 100) : 0
  const activeCatCount = new Set(filteredTransactions.map((t) => map[t.merchant]).filter(Boolean)).size

  // --- Insights tab: apply SpendFilter on top of global filter ---
  const insightsTxs =
    spendFilter === 'all'
      ? filteredTransactions
      : spendFilter === 'recurring'
      ? filteredTransactions.filter(isRecurring)
      : filteredTransactions.filter((t) => !isRecurring(t))

  const insightsTotal = insightsTxs.reduce((s, t) => s + t.amount, 0)
  const recurringTotal = filteredTransactions.filter(isRecurring).reduce((s, t) => s + t.amount, 0)
  const variableTotal = total - recurringTotal

  // --- Chart 1: by category ---
  const catChartData = categories.map((cat) => ({
    name: cat.name,
    icon: cat.icon,
    amount: Math.round(insightsTxs.filter((t) => map[t.merchant] === cat.id).reduce((s, t) => s + t.amount, 0)),
    color: cat.color,
  }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const uncatAmount = Math.round(insightsTxs.filter((t) => !map[t.merchant]).reduce((s, t) => s + t.amount, 0))
  if (uncatAmount > 0) catChartData.push({ name: 'לא ממופה', icon: 'Package', amount: uncatAmount, color: '#c8c3d8' })

  // --- Chart 2: month-over-month ---
  const monthGroups = insightsTxs.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
    ;(acc[key] = acc[key] ?? []).push(tx)
    return acc
  }, {})

  const activeCats = categories.filter((cat) =>
    insightsTxs.some((t) => map[t.merchant] === cat.id),
  )

  const monthChartData = Object.keys(monthGroups).sort().map((key) => {
    const [y, m] = key.split('-')
    const entry: Record<string, unknown> = { month: `${HEBREW_MONTHS[parseInt(m) - 1]} '${y.slice(2)}` }
    for (const cat of activeCats) {
      entry[cat.id] = Math.round(monthGroups[key].filter((t) => map[t.merchant] === cat.id).reduce((s, t) => s + t.amount, 0))
    }
    const uncat = Math.round(monthGroups[key].filter((t) => !map[t.merchant]).reduce((s, t) => s + t.amount, 0))
    if (uncat > 0) entry['_uncat'] = uncat
    return entry
  })

  const dateRange =
    earliest && latest
      ? `${earliest.toLocaleDateString('he-IL', { month: '2-digit', year: 'numeric' })} – ${latest.toLocaleDateString('he-IL', { month: '2-digit', year: 'numeric' })}`
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
        <button style={s.newBtn} onClick={onReset}>
          <FilePlus size={14} strokeWidth={1.75} />חדש
        </button>
      </header>

      {/* ── Summary bar ── */}
      <div style={s.summaryBar}>
        <SCard
          label="קטגוריות פעילות"
          value={`${activeCatCount}`}
          tooltip="מספר הקטגוריות השונות שאליהן שויכו עסקאות בתקופה זו"
        />
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
        <SCard
          label="כיסוי מיפוי"
          value={`${coveragePct}%`}
          color={coveragePct >= 80 ? '#5ba08a' : coveragePct >= 50 ? '#c49a4a' : '#d97090'}
          tooltip="אחוז מסך ההוצאות ששויך לקטגוריה. עבור למיפוי כדי להשלים"
        />
      </div>

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
                  הוצאות לפי קטגוריה
                  <HelpTooltip text="סך ההוצאות בכל קטגוריה, מגבוה לנמוך. 'לא ממופה' הוא בתי עסק שטרם שויכו לקטגוריה — עבור למיפוי כדי להשלים" />
                  <span style={s.cardSub}>{fmt(insightsTotal)}</span>
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
                          >
                            {catChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [fmt(v), 'סכום']} contentStyle={{ fontFamily: 'inherit', direction: 'rtl', fontSize: 13 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>סה״כ</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(insightsTotal)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
                      {catChartData.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <div style={{ width: 11, height: 11, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                          <span style={{ color: d.color, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            <CategoryIcon icon={d.icon} size={13} />
                          </span>
                          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(d.amount)}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 32, textAlign: 'left' }}>
                            {insightsTotal > 0 ? Math.round(d.amount / insightsTotal * 100) : 0}%
                          </span>
                        </div>
                      ))}
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
                    <BarChart data={monthChartData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'inherit' }} />
                      <YAxis tickFormatter={(v: number) => '₪' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
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
                      {activeCats.map((cat) => <Bar key={cat.id} dataKey={cat.id} stackId="s" fill={cat.color} maxBarSize={60} />)}
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
                  <button style={s.addInlineBtn} onClick={addAccount}>+ הוסף חיסכון</button>
                </h2>
                <SavingsCard accounts={accounts} onUpdate={updateAccount} onDelete={deleteAccount} />
              </div>
              <div style={{ ...s.card, minHeight: 200 }} />
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
              <TransactionTable map={map} setMapping={setMapping} />
            </div>
          </div>
        )}

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
  content: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 24px' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', direction: 'rtl' },
  filterGroup: { display: 'flex', gap: '4px', background: 'var(--bg-surface)', borderRadius: '10px', padding: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterBtn: { padding: '6px 14px', border: 'none', borderRadius: '7px', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' },
  filterActive: { background: 'var(--accent)', color: '#fff', fontWeight: 600 },
  splitSummary: { fontSize: '13px', color: 'var(--text-secondary)', direction: 'rtl' },
  cardRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  card: { flex: '1 1 0', minWidth: 0, background: 'var(--bg-surface)', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  cardSub: { fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' },
  addInlineBtn: { marginRight: 'auto', padding: '4px 12px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 },
  empty: { color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0', margin: 0 },
}
