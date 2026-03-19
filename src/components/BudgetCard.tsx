import { useState, useMemo } from 'react'
import type React from 'react'
import { useFilters } from '../context/FilterContext'
import { useCategories } from '../context/CategoriesContext'
import { CategoryIcon } from '../icons'
import { Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import type { ManualEntry, BankEntry } from '../types'
import { buildCategoryTree, getChildCategories } from '../categories'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

interface BudgetCardProps {
  budgets: Record<string, number>
  setBudget: (categoryId: string, amount: number) => void
  removeBudget: (categoryId: string) => void
  map: Record<string, string>
  manualExpenses?: ManualEntry[]
  manualIncome?: ManualEntry[]
  bankEntries?: BankEntry[]
  adding?: boolean
  setAdding?: (v: boolean) => void
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${HEBREW_MONTHS[parseInt(month) - 1]} ${year}`
}

export function BudgetCard({ budgets, setBudget, removeBudget, map, manualExpenses, manualIncome, bankEntries, adding: addingProp, setAdding: setAddingProp }: BudgetCardProps) {
  const { categories } = useCategories()
  const { allTransactions, availableMonths } = useFilters()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingInternal, setAddingInternal] = useState(false)
  const adding = addingProp ?? addingInternal
  const setAdding = setAddingProp ?? setAddingInternal
  const [newCatId, setNewCatId] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [monthOffset, setMonthOffset] = useState(0) // 0 = latest, -1 = previous, etc.

  // Build browsable month list from available data
  const monthKeys = useMemo(() => availableMonths.map((m) => m.key), [availableMonths])

  const displayMonthIdx = useMemo(() => {
    if (monthKeys.length === 0) return -1
    // offset 0 = last month (latest), -1 = one before that, etc.
    const idx = monthKeys.length - 1 + monthOffset
    return Math.max(0, Math.min(idx, monthKeys.length - 1))
  }, [monthKeys, monthOffset])

  const displayMonth = displayMonthIdx >= 0 ? monthKeys[displayMonthIdx] : null
  const displayMonthLbl = displayMonth ? monthLabel(displayMonth) : ''
  const canGoNewer = displayMonthIdx < monthKeys.length - 1
  const canGoOlder = displayMonthIdx > 0

  // Compute actual spending per category for displayed month
  // Budget on parent → actuals sum parent + all children
  // Budget on sub-category → actuals sum only that sub-category
  const actuals = useMemo(() => {
    if (!displayMonth) return {} as Record<string, number>
    // First compute raw per-category actuals
    const raw: Record<string, number> = {}
    for (const tx of allTransactions) {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
      if (key !== displayMonth) continue
      const catId = map[tx.merchant]
      if (!catId) continue
      raw[catId] = (raw[catId] ?? 0) + tx.amount
    }
    if (manualExpenses) {
      for (const me of manualExpenses) {
        if (me.recurring && me.category) {
          raw[me.category] = (raw[me.category] ?? 0) + me.amount
        }
      }
    }
    // For budgeted categories, roll up children if the budget is on a parent
    const result: Record<string, number> = {}
    for (const catId of Object.keys(budgets)) {
      const cat = categories.find((c) => c.id === catId)
      if (!cat) continue
      let total = raw[catId] ?? 0
      // If this is a parent category (no parentId), sum its children too
      if (!cat.parentId) {
        for (const child of getChildCategories(catId, categories)) {
          total += raw[child.id] ?? 0
        }
      }
      result[catId] = total
    }
    return result
  }, [allTransactions, map, displayMonth, manualExpenses, budgets, categories])

  // Monthly income/expense summary
  const monthlySummary = useMemo(() => {
    if (!displayMonth) return { income: 0, expenses: 0, remaining: 0 }

    let income = 0
    let expenses = 0

    // All manual income (salary, random income, etc.)
    if (manualIncome) {
      for (const mi of manualIncome) {
        income += mi.amount
      }
    }

    // Recurring manual expenses
    if (manualExpenses) {
      for (const me of manualExpenses) {
        if (me.recurring) expenses += me.amount
      }
    }

    // Credit card transactions for this month
    for (const tx of allTransactions) {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
      if (key === displayMonth) expenses += tx.amount
    }

    // Recurring bank expenses (excluding credit card payments to avoid double-counting)
    if (bankEntries) {
      for (const be of bankEntries) {
        if (be.recurring && be.payment > 0 && be.vendor !== 'כרטיס אשראי') {
          expenses += be.payment
        }
      }
    }

    return { income, expenses, remaining: income - expenses }
  }, [displayMonth, manualIncome, manualExpenses, allTransactions, bankEntries])

  const budgetedCatIds = Object.keys(budgets).filter((id) =>
    categories.some((c) => c.id === id),
  )

  // unbugdetedCats no longer needed — dropdown uses buildCategoryTree directly

  const totalBudget = budgetedCatIds.reduce((s, id) => s + budgets[id], 0)
  const totalActual = budgetedCatIds.reduce((s, id) => s + (actuals[id] ?? 0), 0)

  function startEdit(catId: string) {
    setEditingId(catId)
    setEditValue(String(budgets[catId]))
  }

  function commitEdit(catId: string) {
    const n = parseFloat(editValue)
    if (!isNaN(n) && n > 0) setBudget(catId, Math.round(n))
    setEditingId(null)
  }

  function handleAddBudget() {
    const n = parseFloat(newAmount)
    if (newCatId && !isNaN(n) && n > 0) {
      setBudget(newCatId, Math.round(n))
      setNewCatId('')
      setNewAmount('')
      setAdding(false)
    }
  }

  const hasSummary = monthlySummary.income > 0
  const spentPct = monthlySummary.income > 0 ? (monthlySummary.expenses / monthlySummary.income) * 100 : 0
  const summaryBarColor = spentPct > 100 ? '#e11d48' : spentPct >= 75 ? '#b45309' : '#0d9488'

  // Empty state — show summary header if income exists, otherwise full empty
  if (budgetedCatIds.length === 0 && !adding && !hasSummary) {
    return (
      <div style={s.empty}>
        <p style={s.emptyText}>הגדר תקציב חודשי לכל קטגוריה כדי לעקוב אחרי ההוצאות שלך</p>
      </div>
    )
  }

  return (
    <div style={s.container}>
      {monthKeys.length > 0 && (
        <div style={s.monthPicker}>
          <button
            style={{ ...s.monthArrow, opacity: canGoOlder ? 1 : 0.25 }}
            onClick={() => canGoOlder && setMonthOffset((o) => o - 1)}
            disabled={!canGoOlder}
            title="חודש קודם"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
          <span style={s.monthLabel}>{displayMonthLbl}</span>
          <button
            style={{ ...s.monthArrow, opacity: canGoNewer ? 1 : 0.25 }}
            onClick={() => canGoNewer && setMonthOffset((o) => o + 1)}
            disabled={!canGoNewer}
            title="חודש הבא"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {hasSummary && (
        <div style={s.summarySection}>
          <div style={s.summaryRow}>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>הכנסות</span>
              <span style={{ ...s.summaryValue, color: '#0d9488' }}>{fmt(Math.round(monthlySummary.income))}</span>
            </div>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>הוצאות</span>
              <span style={{ ...s.summaryValue, color: '#e11d48' }}>{fmt(Math.round(monthlySummary.expenses))}</span>
            </div>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>נשאר</span>
              <span style={{ ...s.summaryRemaining, color: monthlySummary.remaining >= 0 ? '#0d9488' : '#e11d48' }}>
                {fmt(Math.round(Math.abs(monthlySummary.remaining)))}{monthlySummary.remaining < 0 ? '−' : ''}
              </span>
            </div>
          </div>
          <div style={s.summaryBarBg}>
            <div style={{ ...s.summaryBarFill, width: `${Math.min(spentPct, 100)}%`, background: summaryBarColor }} />
          </div>
          <div style={s.summaryPctRow}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(spentPct)}% מההכנסות</span>
          </div>
          {budgetedCatIds.length > 0 && <div style={s.summarySeparator} />}
        </div>
      )}

      {budgetedCatIds.map((catId) => {
        const cat = categories.find((c) => c.id === catId)
        if (!cat) return null
        const actual = actuals[catId] ?? 0
        const budget = budgets[catId]
        const pct = budget > 0 ? (actual / budget) * 100 : 0
        const barColor = pct >= 100 ? '#e11d48' : pct >= 80 ? '#b45309' : '#0d9488'

        return (
          <div key={catId} style={s.row}>
            <div style={s.rowHeader}>
              <span style={{ ...s.catIcon, color: cat.color }}>
                <CategoryIcon icon={cat.icon} size={16} />
              </span>
              <span style={s.catName}>{cat.name}</span>
              <span style={s.pct}>{Math.round(pct)}%</span>
              <button
                style={s.removeBtn}
                onClick={() => removeBudget(catId)}
                title="הסר תקציב"
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>
            <div style={s.barBg}>
              <div style={{ ...s.barFill, width: `${Math.min(pct, 100)}%`, background: barColor }} />
            </div>
            <div style={s.amounts}>
              <span>{fmt(Math.round(actual))}</span>
              <span style={s.separator}>/</span>
              {editingId === catId ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(catId)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(catId) }}
                  style={s.inlineInput}
                  autoFocus
                />
              ) : (
                <span
                  style={s.budgetAmount}
                  onClick={() => startEdit(catId)}
                  title="לחץ לעריכה"
                >
                  {fmt(budget)}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Total row */}
      {budgetedCatIds.length > 0 && (
        <div style={s.totalRow}>
          <span style={s.totalLabel}>סה״כ</span>
          <div style={s.totalAmounts}>
            <span>{fmt(Math.round(totalActual))}</span>
            <span style={s.separator}>/</span>
            <span>{fmt(totalBudget)}</span>
            <span style={{ ...s.totalPct, color: totalBudget > 0 && totalActual / totalBudget >= 1 ? '#e11d48' : '#0d9488' }}>
              ({totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Add budget */}
      {adding && (
        <div style={s.addRow}>
          <select
            value={newCatId}
            onChange={(e) => setNewCatId(e.target.value)}
            style={s.select}
          >
            <option value="">בחר קטגוריה...</option>
            {buildCategoryTree(categories).map((node) => {
              const parentBudgeted = node.parent.id in budgets
              const unbudgetedChildren = node.children.filter((c) => !(c.id in budgets))
              if (node.children.length > 0) {
                return (
                  <optgroup key={node.parent.id} label={node.parent.name}>
                    {!parentBudgeted && <option value={node.parent.id}>{node.parent.name} (כולל תת-קטגוריות)</option>}
                    {unbudgetedChildren.map((child) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </optgroup>
                )
              }
              return !parentBudgeted ? (
                <option key={node.parent.id} value={node.parent.id}>{node.parent.name}</option>
              ) : null
            })}
          </select>
          <input
            type="number"
            placeholder="סכום"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddBudget() }}
            style={s.amountInput}
          />
          <button style={s.confirmBtn} onClick={handleAddBudget}>הוסף</button>
          <button style={s.cancelBtn} onClick={() => { setAdding(false); setNewCatId(''); setNewAmount('') }}>ביטול</button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 12, direction: 'rtl' },
  monthPicker: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 4 },
  monthArrow: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', transition: 'background 0.15s' },
  monthLabel: { fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, minWidth: 100, textAlign: 'center' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' },
  emptyText: { margin: 0, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' },
  row: { display: 'flex', flexDirection: 'column', gap: 4 },
  rowHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  catIcon: { flexShrink: 0, display: 'flex', alignItems: 'center' },
  catName: { flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
  pct: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 36, textAlign: 'left' },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-faint)', lineHeight: 1, borderRadius: 4 },
  barBg: { height: 8, borderRadius: 4, background: 'var(--bg-primary)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s ease' },
  amounts: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' },
  separator: { color: 'var(--text-faint)' },
  budgetAmount: { cursor: 'pointer', borderBottom: '1px dashed var(--border)', paddingBottom: 1 },
  inlineInput: { width: 70, padding: '2px 6px', border: '1px solid var(--accent)', borderRadius: 4, fontFamily: 'inherit', fontSize: 12, direction: 'rtl', background: 'var(--bg-primary)', outline: 'none' },
  totalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 },
  totalLabel: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' },
  totalAmounts: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 },
  totalPct: { fontSize: 11, fontWeight: 600 },
  addRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  select: { flex: '1 1 120px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', direction: 'rtl' },
  amountInput: { width: 80, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', direction: 'rtl' },
  confirmBtn: { padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' },
  addBtn: { alignSelf: 'center', padding: '6px 16px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 },
  summarySection: { display: 'flex', flexDirection: 'column', gap: 6 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: 600 },
  summaryRemaining: { fontSize: 22, fontWeight: 700 },
  summaryBarBg: { height: 10, borderRadius: 5, background: 'var(--bg-primary)', overflow: 'hidden' },
  summaryBarFill: { height: '100%', borderRadius: 5, transition: 'width 0.3s ease' },
  summaryPctRow: { display: 'flex', justifyContent: 'flex-end' },
  summarySeparator: { borderTop: '1px solid var(--border)', marginTop: 4 },
}
