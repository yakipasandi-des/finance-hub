import { useState, useMemo, useEffect } from 'react'
import type React from 'react'
import { useFilters } from '../context/FilterContext'
import { useCategories } from '../context/CategoriesContext'
import { CategoryIcon } from '../icons'
import { Trash2, ArrowRight, ArrowLeft, Lightbulb, X, Plus, ChevronDown } from 'lucide-react'
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
  showSuggestionsModal?: boolean
  setShowSuggestionsModal?: (v: boolean) => void
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${HEBREW_MONTHS[parseInt(month) - 1]} ${year}`
}

export function BudgetCard({ budgets, setBudget, removeBudget, map, manualExpenses, manualIncome, bankEntries, adding: addingProp, setAdding: setAddingProp, showSuggestionsModal, setShowSuggestionsModal }: BudgetCardProps) {
  const { categories } = useCategories()
  const { allTransactions, availableMonths } = useFilters()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingInternal, setAddingInternal] = useState(false)
  const adding = addingProp ?? addingInternal
  const setAdding = setAddingProp ?? setAddingInternal
  const [newCatId, setNewCatId] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [monthOffset, setMonthOffset] = useState(0)
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [subCatId, setSubCatId] = useState('')
  const [subAmount, setSubAmount] = useState('')
  const [expandedParent, setExpandedParent] = useState<string | null>(null)

  // Build browsable month list from available data
  const monthKeys = useMemo(() => availableMonths.map((m) => m.key), [availableMonths])

  const displayMonthIdx = useMemo(() => {
    if (monthKeys.length === 0) return -1
    const idx = monthKeys.length - 1 + monthOffset
    return Math.max(0, Math.min(idx, monthKeys.length - 1))
  }, [monthKeys, monthOffset])

  const displayMonth = displayMonthIdx >= 0 ? monthKeys[displayMonthIdx] : null
  const displayMonthLbl = displayMonth ? monthLabel(displayMonth) : ''
  const canGoNewer = displayMonthIdx < monthKeys.length - 1
  const canGoOlder = displayMonthIdx > 0

  // Compute raw per-category actuals and rolled-up parent actuals
  const { rawActuals, parentActuals } = useMemo(() => {
    const raw: Record<string, number> = {}
    if (!displayMonth) return { rawActuals: raw, parentActuals: {} as Record<string, number> }

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

    // Roll up parent actuals: for each budgeted parent, sum self + all children
    const pActuals: Record<string, number> = {}
    for (const catId of Object.keys(budgets)) {
      const cat = categories.find((c) => c.id === catId)
      if (!cat || cat.parentId) continue // only parents
      let total = raw[catId] ?? 0
      for (const child of getChildCategories(catId, categories)) {
        total += raw[child.id] ?? 0
      }
      pActuals[catId] = total
    }

    return { rawActuals: raw, parentActuals: pActuals }
  }, [allTransactions, map, displayMonth, manualExpenses, budgets, categories])

  // Monthly income/expense summary
  const monthlySummary = useMemo(() => {
    if (!displayMonth) return { income: 0, expenses: 0, remaining: 0 }

    let income = 0
    let expenses = 0

    if (manualIncome) {
      for (const mi of manualIncome) {
        income += mi.amount
      }
    }

    if (manualExpenses) {
      for (const me of manualExpenses) {
        if (me.recurring) expenses += me.amount
      }
    }

    for (const tx of allTransactions) {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
      if (key === displayMonth) expenses += tx.amount
    }

    if (bankEntries) {
      for (const be of bankEntries) {
        if (be.recurring && be.payment > 0 && be.vendor !== 'כרטיס אשראי') {
          expenses += be.payment
        }
      }
    }

    return { income, expenses, remaining: income - expenses }
  }, [displayMonth, manualIncome, manualExpenses, allTransactions, bankEntries])

  // Compute per-category average monthly spending (rolled up into parents)
  const avgByCategory = useMemo(() => {
    if (monthKeys.length === 0) return {} as Record<string, number>
    const totalByCategory: Record<string, number> = {}
    for (const tx of allTransactions) {
      const catId = map[tx.merchant]
      if (!catId) continue
      totalByCategory[catId] = (totalByCategory[catId] ?? 0) + tx.amount
    }
    if (manualExpenses) {
      for (const me of manualExpenses) {
        if (me.recurring && me.category) {
          totalByCategory[me.category] = (totalByCategory[me.category] ?? 0) + me.amount * monthKeys.length
        }
      }
    }
    // Roll up children into parents
    const rolled: Record<string, number> = {}
    const tree = buildCategoryTree(categories)
    for (const node of tree) {
      let total = totalByCategory[node.parent.id] ?? 0
      for (const child of node.children) {
        total += totalByCategory[child.id] ?? 0
      }
      if (total > 0) rolled[node.parent.id] = total / monthKeys.length
    }
    return rolled
  }, [allTransactions, map, monthKeys, manualExpenses, categories])

  interface BudgetSuggestion {
    catId: string
    type: 'increase' | 'decrease' | 'new'
    currentBudget: number
    suggestedAmount: number
    avgSpending: number
  }

  // Suggestions target only parent categories
  const suggestions = useMemo<BudgetSuggestion[]>(() => {
    const result: BudgetSuggestion[] = []
    // Existing budgeted parents
    for (const catId of Object.keys(budgets)) {
      const cat = categories.find((c) => c.id === catId)
      if (!cat || cat.parentId) continue // only parents
      const avg = avgByCategory[catId]
      if (avg == null || avg === 0) continue
      const budget = budgets[catId]
      const rounded = Math.round(avg / 50) * 50 || 50
      if (avg > budget * 1.2) {
        result.push({ catId, type: 'increase', currentBudget: budget, suggestedAmount: rounded, avgSpending: avg })
      } else if (avg < budget * 0.8) {
        result.push({ catId, type: 'decrease', currentBudget: budget, suggestedAmount: rounded, avgSpending: avg })
      }
    }
    // Unbudgeted parent categories with spending
    for (const catId of Object.keys(avgByCategory)) {
      if (catId in budgets) continue
      const cat = categories.find((c) => c.id === catId)
      if (!cat || cat.parentId) continue // only parents
      const avg = avgByCategory[catId]
      if (avg == null || avg === 0) continue
      const rounded = Math.round(avg / 50) * 50 || 50
      result.push({ catId, type: 'new', currentBudget: 0, suggestedAmount: rounded, avgSpending: avg })
    }
    return result
  }, [budgets, avgByCategory, categories])

  const [checkedSuggestions, setCheckedSuggestions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (showSuggestionsModal) {
      setCheckedSuggestions(new Set())
    }
  }, [showSuggestionsModal])

  function toggleSuggestion(catId: string) {
    setCheckedSuggestions((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  function applyCheckedSuggestions() {
    for (const sg of suggestions) {
      if (checkedSuggestions.has(sg.catId)) {
        setBudget(sg.catId, sg.suggestedAmount)
      }
    }
    setShowSuggestionsModal?.(false)
  }

  function closeModal() {
    setShowSuggestionsModal?.(false)
  }

  // Build list of budgeted parent categories
  const tree = useMemo(() => buildCategoryTree(categories), [categories])

  const budgetedParents = useMemo(() => {
    return tree.filter((node) => node.parent.id in budgets)
  }, [tree, budgets])

  // Totals: only count parent-level budgets (sub-budgets are slices, not additive)
  const totalBudget = budgetedParents.reduce((s, node) => s + budgets[node.parent.id], 0)
  const totalActual = budgetedParents.reduce((s, node) => s + (parentActuals[node.parent.id] ?? 0), 0)

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

  function handleAddSubBudget(parentId: string) {
    const n = parseFloat(subAmount)
    if (!subCatId || isNaN(n) || n <= 0) return
    // Validate: sub-budget ≤ remaining flex
    const parentBudget = budgets[parentId] ?? 0
    const children = getChildCategories(parentId, categories)
    const subBudgetedSum = children.reduce((s, c) => s + (budgets[c.id] ?? 0), 0)
    const flexBudget = parentBudget - subBudgetedSum
    if (Math.round(n) > flexBudget) return
    setBudget(subCatId, Math.round(n))
    setAddingSubFor(null)
    setSubCatId('')
    setSubAmount('')
  }

  function removeSubBudget(childId: string) {
    removeBudget(childId)
  }

  const hasSummary = monthlySummary.income > 0
  const spentPct = monthlySummary.income > 0 ? (monthlySummary.expenses / monthlySummary.income) * 100 : 0
  const summaryBarColor = spentPct > 100 ? 'var(--red)' : spentPct >= 75 ? 'var(--yellow)' : 'var(--green)'

  // Empty state
  if (budgetedParents.length === 0 && !adding && !hasSummary) {
    return (
      <div style={s.empty}>
        <p style={s.emptyText}>הגדר תקציב חודשי לכל קטגוריה כדי לעקוב אחרי ההוצאות שלך</p>
      </div>
    )
  }

  // Helper: get bar color from percentage
  function barColor(pct: number) {
    return pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)'
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
            <ArrowRight size={14} strokeWidth={2} />
          </button>
          <span style={s.monthLabel}>{displayMonthLbl}</span>
          <button
            style={{ ...s.monthArrow, opacity: canGoNewer ? 1 : 0.25 }}
            onClick={() => canGoNewer && setMonthOffset((o) => o + 1)}
            disabled={!canGoNewer}
            title="חודש הבא"
          >
            <ArrowLeft size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {hasSummary && (
        <div style={s.summarySection}>
          <div style={s.summaryRow}>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>הכנסות</span>
              <span style={{ ...s.summaryValue, color: 'var(--green)' }}>{fmt(Math.round(monthlySummary.income))}</span>
            </div>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>הוצאות</span>
              <span style={{ ...s.summaryValue, color: 'var(--red)' }}>{fmt(Math.round(monthlySummary.expenses))}</span>
            </div>
            <div style={s.summaryItem}>
              <span style={s.summaryLabel}>נשאר</span>
              <span style={{ ...s.summaryRemaining, color: monthlySummary.remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
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
          {budgetedParents.length > 0 && <div style={s.summarySeparator} />}
        </div>
      )}

      {budgetedParents.map((node) => {
        const parentId = node.parent.id
        const parentBudget = budgets[parentId]
        const parentActual = parentActuals[parentId] ?? 0
        const parentPct = parentBudget > 0 ? (parentActual / parentBudget) * 100 : 0

        // Find sub-budgeted children
        const subBudgetedChildren = node.children.filter((c) => c.id in budgets)
        const hasSubBudgets = subBudgetedChildren.length > 0

        // Unbudgeted children for sub-budget add flow
        const unbudgetedChildren = node.children.filter((c) => !(c.id in budgets))

        const isExpanded = expandedParent === parentId

        return (
          <div key={parentId} style={s.parentGroup}>
            {/* Parent row header — clickable to expand/collapse */}
            <div
              style={s.rowHeaderClickable}
              onClick={() => setExpandedParent(isExpanded ? null : parentId)}
            >
              <span style={{ ...s.chevron, transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                <ChevronDown size={14} strokeWidth={2} />
              </span>
              <span style={{ ...s.catIcon, color: node.parent.color }}>
                <CategoryIcon icon={node.parent.icon} size={16} />
              </span>
              <span style={s.catName}>{node.parent.name}</span>
              <span style={s.pct}>{Math.round(parentPct)}%</span>
              <button
                style={s.removeBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  // Remove parent budget and all sub-budgets
                  for (const c of subBudgetedChildren) removeBudget(c.id)
                  removeBudget(parentId)
                }}
                title="הסר תקציב"
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>

            {/* Bar — always visible */}
            <div style={s.barBg}>
              <div style={{ ...s.barFill, width: `${Math.min(parentPct, 100)}%`, background: barColor(parentPct) }} />
            </div>

            {/* Amounts — always visible */}
            <div style={s.amounts}>
              <span>{fmt(Math.round(parentActual))}</span>
              <span style={s.separator}>/</span>
              {editingId === parentId ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(parentId)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(parentId); if (e.key === 'Escape') setEditingId(null) }}
                  style={s.inlineInput}
                  autoFocus
                />
              ) : (
                <span
                  style={s.budgetAmount}
                  onClick={(e) => { e.stopPropagation(); startEdit(parentId) }}
                  title="לחץ לעריכה"
                >
                  {fmt(parentBudget)}
                </span>
              )}
            </div>

            {/* Expanded content — sub-budget rows + add sub */}
            {isExpanded && (
              <>
                {hasSubBudgets && subBudgetedChildren.map((child) => {
                  const childBudget = budgets[child.id]
                  const childActual = rawActuals[child.id] ?? 0
                  const childPct = childBudget > 0 ? (childActual / childBudget) * 100 : 0

                  return (
                    <div key={child.id} style={s.subRow}>
                      <div style={s.rowHeader}>
                        <span style={{ ...s.catIcon, color: child.color }}>
                          <CategoryIcon icon={child.icon} size={13} />
                        </span>
                        <span style={s.subCatName}>{child.name}</span>
                        <span style={s.subPct}>{Math.round(childPct)}%</span>
                        <button
                          style={s.removeBtn}
                          onClick={() => removeSubBudget(child.id)}
                          title="הסר תת-תקציב"
                        >
                          <Trash2 size={11} strokeWidth={1.75} />
                        </button>
                      </div>
                      <div style={s.subBarBg}>
                        <div style={{ ...s.subBarFill, width: `${Math.min(childPct, 100)}%`, background: barColor(childPct) }} />
                      </div>
                      <div style={s.subAmounts}>
                        <span>{fmt(Math.round(childActual))}</span>
                        <span style={s.separator}>/</span>
                        {editingId === child.id ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(child.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(child.id); if (e.key === 'Escape') setEditingId(null) }}
                            style={s.inlineInput}
                            autoFocus
                          />
                        ) : (
                          <span
                            style={s.budgetAmount}
                            onClick={() => startEdit(child.id)}
                            title="לחץ לעריכה"
                          >
                            {fmt(childBudget)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Add sub-budget inline flow */}
                {addingSubFor === parentId ? (
                  <div style={s.addSubRow}>
                    <select
                      value={subCatId}
                      onChange={(e) => setSubCatId(e.target.value)}
                      style={s.subSelect}
                    >
                      <option value="">בחר תת-קטגוריה...</option>
                      {unbudgetedChildren.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="סכום"
                      value={subAmount}
                      onChange={(e) => setSubAmount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubBudget(parentId) }}
                      style={s.subAmountInput}
                    />
                    <button style={s.subConfirmBtn} onClick={() => handleAddSubBudget(parentId)}>אשר</button>
                    <button style={s.subCancelBtn} onClick={() => { setAddingSubFor(null); setSubCatId(''); setSubAmount('') }}>ביטול</button>
                  </div>
                ) : (
                  unbudgetedChildren.length > 0 && (
                    <button
                      style={s.addSubBtn}
                      onClick={() => { setAddingSubFor(parentId); setSubCatId(''); setSubAmount('') }}
                    >
                      <Plus size={11} strokeWidth={2} />
                      <span>הוסף תת-תקציב</span>
                    </button>
                  )
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Total row */}
      {budgetedParents.length > 0 && (
        <div style={s.totalRow}>
          <span style={s.totalLabel}>סה״כ</span>
          <div style={s.totalAmounts}>
            <span>{fmt(Math.round(totalActual))}</span>
            <span style={s.separator}>/</span>
            <span>{fmt(totalBudget)}</span>
            <span style={{ ...s.totalPct, color: totalBudget > 0 && totalActual / totalBudget >= 1 ? 'var(--red)' : 'var(--green)' }}>
              ({totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Suggestions modal */}
      {showSuggestionsModal && suggestions.length > 0 && (
        <div style={s.modalOverlay} onClick={closeModal}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <Lightbulb size={16} strokeWidth={2} color="var(--accent)" />
              <span style={s.modalTitle}>הצעות תקציב</span>
              <button style={s.modalClose} onClick={closeModal} title="סגור">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <p style={s.modalDesc}>על סמך ממוצע ההוצאות החודשי שלך, אלה ההצעות שלנו:</p>
            <div style={s.modalBody}>
              <div style={s.suggestionsList}>
                {suggestions.map((sg) => {
                  const cat = categories.find((c) => c.id === sg.catId)
                  if (!cat) return null
                  const arrow = sg.type === 'increase' ? '↑' : sg.type === 'decrease' ? '↓' : 'חדש'
                  const arrowColor = sg.type === 'increase' ? 'var(--red)' : sg.type === 'decrease' ? 'var(--green)' : 'var(--accent)'
                  const checked = checkedSuggestions.has(sg.catId)
                  return (
                    <label key={sg.catId} style={{ ...s.suggestionRow, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSuggestion(sg.catId)}
                        style={s.checkbox}
                      />
                      <span style={{ ...s.catIcon, color: cat.color }}>
                        <CategoryIcon icon={cat.icon} size={14} />
                      </span>
                      <span style={s.suggestionName}>{cat.name}</span>
                      <span style={{ ...s.suggestionTag, color: arrowColor, background: arrowColor + '14' }}>{arrow}</span>
                      <span style={s.suggestionAmounts}>
                        {sg.type !== 'new' && <><span style={s.suggestionOld}>{fmt(sg.currentBudget)}</span><span style={{ color: 'var(--text-faint)' }}>→</span></>}
                        <span style={s.suggestionNew}>{fmt(sg.suggestedAmount)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div style={s.modalFooter}>
              <button
                style={{ ...s.confirmBtn, opacity: checkedSuggestions.size === 0 ? 0.5 : 1 }}
                onClick={applyCheckedSuggestions}
                disabled={checkedSuggestions.size === 0}
              >
                אשר ({checkedSuggestions.size})
              </button>
              <button style={s.cancelBtn} onClick={closeModal}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Add budget — only show unbudgeted parents */}
      {adding && (
        <div style={s.addRow}>
          <select
            value={newCatId}
            onChange={(e) => setNewCatId(e.target.value)}
            style={s.select}
          >
            <option value="">בחר קטגוריה...</option>
            {tree
              .filter((node) => !(node.parent.id in budgets))
              .map((node) => (
                <option key={node.parent.id} value={node.parent.id}>{node.parent.name}</option>
              ))}
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
  monthArrow: { background: '#fff', border: '1px solid var(--border)', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, box-shadow 0.15s', boxShadow: 'var(--shadow-sm)', width: 28, height: 28 },
  monthLabel: { fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, minWidth: 100, textAlign: 'center' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' },
  emptyText: { margin: 0, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' },
  parentGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', flexDirection: 'column', gap: 4 },
  rowHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  rowHeaderClickable: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' as const },
  chevron: { display: 'flex', alignItems: 'center', color: 'var(--text-muted)', transition: 'transform 0.2s ease', flexShrink: 0 },
  catIcon: { flexShrink: 0, display: 'flex', alignItems: 'center' },
  catName: { flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
  pct: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 36, textAlign: 'left' as const },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-faint)', lineHeight: 1, borderRadius: 4 },
  barBg: { height: 6, borderRadius: 3, background: 'var(--bg-primary)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.4s ease' },
  amounts: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' },
  separator: { color: 'var(--text-faint)' },
  budgetAmount: { cursor: 'pointer', borderBottom: '1px dashed var(--border)', paddingBottom: 1 },
  inlineInput: { width: 70, padding: '2px 6px', border: '1px solid var(--accent)', borderRadius: 4, fontFamily: 'inherit', fontSize: 12, direction: 'rtl' as const, background: 'var(--bg-primary)', outline: 'none' },

  // Sub-budget rows
  subRow: { display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 24 },
  subCatName: { flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' },
  subPct: { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 32, textAlign: 'left' as const },
  subBarBg: { height: 4, borderRadius: 2, background: 'var(--bg-primary)', overflow: 'hidden' },
  subBarFill: { height: '100%', borderRadius: 2, transition: 'width 0.4s ease' },
  subAmounts: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' },

  // Segmented bar

  // Add sub-budget button
  addSubBtn: { alignSelf: 'flex-start', marginRight: 24, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 },


  // Add sub-budget inline form
  addSubRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, paddingRight: 24 },
  subSelect: { flex: '1 1 100px', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, background: 'var(--bg-primary)', direction: 'rtl' as const },
  subAmountInput: { width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, background: 'var(--bg-primary)', direction: 'rtl' as const },
  subConfirmBtn: { padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  subCancelBtn: { padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' },

  totalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 },
  totalLabel: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' },
  totalAmounts: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 },
  totalPct: { fontSize: 11, fontWeight: 600 },
  addRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const },
  select: { flex: '1 1 120px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', direction: 'rtl' as const },
  amountInput: { width: 80, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: 'var(--bg-primary)', direction: 'rtl' as const },
  confirmBtn: { padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s ease' },
  cancelBtn: { padding: '7px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s ease' },
  addBtn: { alignSelf: 'center', padding: '6px 16px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 },
  summarySection: { display: 'flex', flexDirection: 'column', gap: 6 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: 600 },
  summaryRemaining: { fontSize: 22, fontWeight: 700 },
  summaryBarBg: { height: 8, borderRadius: 4, background: 'var(--bg-primary)', overflow: 'hidden' },
  summaryBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },
  summaryPctRow: { display: 'flex', justifyContent: 'flex-end' },
  summarySeparator: { borderTop: '1px solid var(--border)', marginTop: 4 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modalContent: { background: '#fff', borderRadius: 14, maxWidth: 440, width: '100%', direction: 'rtl' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: 500, overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '20px 24px 0 24px' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalDesc: { margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 24px 0 24px' },
  modalBody: { flex: 1, overflowY: 'auto', padding: '16px 24px' },
  modalFooter: { display: 'flex', gap: 8, padding: '12px 24px', borderTop: '1px solid var(--border)', background: '#fff', flexShrink: 0 },
  suggestionsList: { display: 'flex', flexDirection: 'column', gap: 4 },
  suggestionRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-primary)', transition: 'opacity 0.15s' },
  checkbox: { accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 },
  suggestionName: { flex: 1, fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 },
  suggestionTag: { fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 6 },
  suggestionAmounts: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' },
  suggestionOld: { textDecoration: 'line-through', color: 'var(--text-muted)' },
  suggestionNew: { fontWeight: 600, color: 'var(--text-primary)' },
}
