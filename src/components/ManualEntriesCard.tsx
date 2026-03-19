import { useState, useRef, useEffect } from 'react'
import { Check, X, Trash2 } from 'lucide-react'
import type { ManualEntry } from '../types'
import { useCategories } from '../context/CategoriesContext'
import { buildCategoryTree } from '../categories'

interface Props {
  entries: ManualEntry[]
  onAdd: (type: 'expense' | 'income') => string
  onUpdate: (id: string, changes: Partial<Omit<ManualEntry, 'id'>>) => void
  onDelete: (id: string) => void
  filter?: 'expense' | 'income'
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

interface RowDraft {
  name: string
  amount: string
  recurring: boolean
  category: string
}

export function ManualEntriesCard({ entries, onAdd, onUpdate, onDelete, filter }: Props) {
  const { categories } = useCategories()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RowDraft>({ name: '', amount: '', recurring: true, category: '' })
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const prevFirstExpenseRef = useRef<string | undefined>()
  const prevFirstIncomeRef = useRef<string | undefined>()

  const expenses = entries.filter((e) => e.type === 'expense')
  const incomes = entries.filter((e) => e.type === 'income')

  // Auto-enter edit mode for newly added blank entries
  useEffect(() => {
    const firstExp = expenses[0]
    if (firstExp && firstExp.id !== prevFirstExpenseRef.current && firstExp.name === '' && firstExp.amount === 0) {
      setEditingId(firstExp.id)
      setDraft({ name: '', amount: '', recurring: true, category: '' })
    }
    prevFirstExpenseRef.current = firstExp?.id
  }, [expenses])

  useEffect(() => {
    const firstInc = incomes[0]
    if (firstInc && firstInc.id !== prevFirstIncomeRef.current && firstInc.name === '' && firstInc.amount === 0) {
      setEditingId(firstInc.id)
      setDraft({ name: '', amount: '', recurring: true, category: '' })
    }
    prevFirstIncomeRef.current = firstInc?.id
  }, [incomes])

  useEffect(() => {
    if (editingId) nameRef.current?.focus()
  }, [editingId])

  function startEdit(entry: ManualEntry) {
    if (editingId === entry.id) return
    setEditingId(entry.id)
    setDraft({ name: entry.name, amount: String(entry.amount), recurring: entry.recurring, category: entry.category ?? '' })
  }

  function commitEdit() {
    if (!editingId) return
    onUpdate(editingId, {
      name: draft.name.trim(),
      amount: parseFloat(draft.amount) || 0,
      recurring: draft.recurring,
      category: draft.category || undefined,
    })
    setEditingId(null)
  }

  function cancelEdit(id: string, isNew: boolean) {
    if (isNew) onDelete(id)
    setEditingId(null)
  }

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const incomeTotal = incomes.reduce((s, e) => s + e.amount, 0)
  const balance = incomeTotal - expenseTotal

  function renderRow(entry: ManualEntry, isExpense: boolean) {
    const isEditing = editingId === entry.id
    const isHovered = hoveredRow === entry.id
    const isNew = entry.name === '' && entry.amount === 0

    if (isEditing) {
      return (
        <div key={entry.id} style={st.row}>
          <input
            ref={nameRef}
            style={st.input}
            placeholder={isExpense ? 'שם ההוצאה' : 'שם ההכנסה'}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(entry.id, isNew) }}
          />
          <input
            style={{ ...st.input, ...st.amountInput }}
            placeholder="סכום"
            type="number"
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(entry.id, isNew) }}
          />
          <button
            style={{ ...st.toggleBtn, ...(draft.recurring ? st.toggleActive : {}) }}
            onClick={() => setDraft((d) => ({ ...d, recurring: !d.recurring }))}
            title={draft.recurring ? 'חודשי' : 'חד פעמי'}
          >
            {draft.recurring ? 'חודשי' : 'חד פעמי'}
          </button>
          {isExpense && (
            <select
              style={st.catSelect}
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
              <option value="">ללא קטגוריה</option>
              {buildCategoryTree(categories).map((node) =>
                node.children.length > 0 ? (
                  <optgroup key={node.parent.id} label={node.parent.name}>
                    <option value={node.parent.id}>{node.parent.name} (כללי)</option>
                    {node.children.map((child) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={node.parent.id} value={node.parent.id}>{node.parent.name}</option>
                )
              )}
            </select>
          )}
          <button style={st.actionBtn} onClick={commitEdit} title="שמור"><Check size={14} strokeWidth={2} /></button>
          <button style={{ ...st.actionBtn, color: 'var(--red)' }} onClick={() => cancelEdit(entry.id, isNew)} title="בטל"><X size={14} strokeWidth={2} /></button>
        </div>
      )
    }

    const catName = isExpense && entry.category
      ? categories.find((c) => c.id === entry.category)?.name
      : null

    return (
      <div
        key={entry.id}
        style={{ ...st.row, background: isHovered ? 'var(--bg-primary)' : 'transparent', cursor: 'pointer' }}
        onMouseEnter={() => setHoveredRow(entry.id)}
        onMouseLeave={() => setHoveredRow(null)}
        onClick={() => startEdit(entry)}
      >
        <span style={st.name}>{entry.name || <span style={{ color: 'var(--text-faint)' }}>ללא שם</span>}</span>
        {entry.recurring && <span style={st.badge}>חודשי</span>}
        {catName && <span style={st.catBadge}>{catName}</span>}
        <span style={{ ...st.amount, color: isExpense ? 'var(--red)' : 'var(--green)' }}>
          {isExpense ? '-' : '+'}{fmt(entry.amount)}
        </span>
        <button
          style={{ ...st.actionBtn, opacity: isHovered ? 1 : 0, color: 'var(--red)', transition: 'opacity 0.15s' }}
          onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
          title="מחק"
          tabIndex={isHovered ? 0 : -1}
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </div>
    )
  }

  const showExpenses = !filter || filter === 'expense'
  const showIncomes = !filter || filter === 'income'

  return (
    <div style={st.wrap}>
      <div style={filter ? {} : st.columns}>
        {showExpenses && (
          <div style={st.section}>
            {!filter && (
              <h3 style={st.sectionTitle}>
                הוצאות ידניות
                <button style={st.addBtn} onClick={() => onAdd('expense')}>+ הוסף הוצאה</button>
              </h3>
            )}
            {filter && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button style={st.addBtn} onClick={() => onAdd('expense')}>+ הוסף הוצאה</button>
              </div>
            )}
            {expenses.length === 0 && editingId === null && (
              <p style={st.empty}>אין הוצאות ידניות.</p>
            )}
            {expenses.map((e) => renderRow(e, true))}
            {expenses.length > 0 && (
              <div style={st.subtotalRow}>
                <span style={st.subtotalLabel}>סה״כ הוצאות</span>
                <span style={{ ...st.subtotalAmount, color: 'var(--red)' }}>{fmt(expenseTotal)}</span>
              </div>
            )}
          </div>
        )}

        {showIncomes && (
          <div style={st.section}>
            {!filter && (
              <h3 style={st.sectionTitle}>
                הכנסות
                <button style={st.addBtn} onClick={() => onAdd('income')}>+ הוסף הכנסה</button>
              </h3>
            )}
            {filter && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button style={st.addBtn} onClick={() => onAdd('income')}>+ הוסף הכנסה</button>
              </div>
            )}
            {incomes.length === 0 && editingId === null && (
              <p style={st.empty}>אין הכנסות.</p>
            )}
            {incomes.map((e) => renderRow(e, false))}
            {incomes.length > 0 && (
              <div style={st.subtotalRow}>
                <span style={st.subtotalLabel}>סה״כ הכנסות</span>
                <span style={{ ...st.subtotalAmount, color: 'var(--green)' }}>{fmt(incomeTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Net balance — only when showing both */}
      {!filter && (expenses.length > 0 || incomes.length > 0) && (
        <div style={st.balanceRow}>
          <span style={st.balanceLabel}>מאזן:</span>
          <span style={{ ...st.balanceAmount, color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {balance >= 0 ? '+' : ''}{fmt(balance)}
          </span>
        </div>
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12, direction: 'rtl' },
  columns: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  section: { flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 4 },
  sectionTitle: { margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 },
  empty: { color: 'var(--text-muted)', fontSize: 13, margin: '8px 0', textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 8, borderBottom: '1px solid var(--border)', transition: 'background 0.1s' },
  name: { flex: '2 1 0', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  amount: { flex: '0 0 auto', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' },
  badge: { fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: '#ede9f8', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' },
  catBadge: { fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' },
  input: { flex: '2 1 0', fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 0, direction: 'rtl' },
  amountInput: { flex: '1 0 70px', textAlign: 'left', direction: 'ltr' },
  toggleBtn: { fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  toggleActive: { background: '#ede9f8', color: 'var(--accent)', borderColor: 'var(--accent)' },
  catSelect: { flex: '1 0 90px', fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--bg-primary)', direction: 'rtl' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 },
  subtotalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 6px 4px', borderTop: '2px solid var(--border)', marginTop: 4 },
  subtotalLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' },
  subtotalAmount: { fontSize: 15, fontWeight: 700 },
  balanceRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 6px', borderTop: '2px solid var(--border)', marginTop: 4 },
  balanceLabel: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  balanceAmount: { fontSize: 18, fontWeight: 700 },
  addBtn: { marginRight: 'auto', padding: '3px 10px', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', color: '#fff', fontWeight: 600 },
}
