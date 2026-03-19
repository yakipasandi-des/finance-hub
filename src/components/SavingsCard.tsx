import { useState, useRef, useEffect } from 'react'
import { Check, X, Trash2 } from 'lucide-react'
import type { SavingsAccount } from '../types'

interface Props {
  accounts: SavingsAccount[]
  onUpdate: (id: string, changes: Partial<Omit<SavingsAccount, 'id'>>) => void
  onDelete: (id: string) => void
  savingsGoal: number
  onSetGoal: (amount: number) => void
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

interface RowDraft {
  name: string
  managedBy: string
  amount: string
}

export function SavingsCard({ accounts, onUpdate, onDelete, savingsGoal, onSetGoal }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RowDraft>({ name: '', managedBy: '', amount: '' })
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [hoveredField, setHoveredField] = useState<string | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const goalInputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const prevFirstIdRef = useRef<string | undefined>(accounts[0]?.id)

  // Auto-enter edit mode when a new blank row appears at the top
  useEffect(() => {
    const first = accounts[0]
    if (first && first.id !== prevFirstIdRef.current && first.name === '' && first.amount === 0) {
      setEditingId(first.id)
      setDraft({ name: '', managedBy: '', amount: '' })
    }
    prevFirstIdRef.current = first?.id
  }, [accounts])

  useEffect(() => {
    if (editingId) nameRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (editingGoal) goalInputRef.current?.focus()
  }, [editingGoal])

  function startGoalEdit() {
    setGoalDraft(savingsGoal > 0 ? String(savingsGoal) : '')
    setEditingGoal(true)
  }

  function commitGoalEdit() {
    onSetGoal(parseFloat(goalDraft) || 0)
    setEditingGoal(false)
  }

  function cancelGoalEdit() {
    setEditingGoal(false)
  }

  function startEdit(account: SavingsAccount) {
    if (editingId === account.id) return
    setEditingId(account.id)
    setDraft({ name: account.name, managedBy: account.managedBy, amount: String(account.amount) })
  }

  function commitEdit() {
    if (!editingId) return
    onUpdate(editingId, {
      name: draft.name.trim(),
      managedBy: draft.managedBy.trim(),
      amount: parseFloat(draft.amount) || 0,
    })
    setEditingId(null)
  }

  function cancelEdit(id: string, isNew: boolean) {
    if (isNew) onDelete(id)
    setEditingId(null)
  }

  const total = accounts.reduce((s, a) => s + a.amount, 0)

  return (
    <div style={s.wrap}>
      {accounts.length === 0 && !editingId && (
        <p style={s.empty}>אין חסכונות עדיין.</p>
      )}

      {accounts.map((account) => {
        const isEditing = editingId === account.id
        const isHovered = hoveredRow === account.id
        const isNew = account.name === '' && account.managedBy === '' && account.amount === 0

        if (isEditing) {
          return (
            <div key={account.id} style={s.row}>
              <input
                ref={nameRef}
                style={s.input}
                placeholder="שם החיסכון"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(account.id, isNew) }}
              />
              <input
                style={s.input}
                placeholder="גוף מנהל"
                value={draft.managedBy}
                onChange={(e) => setDraft((d) => ({ ...d, managedBy: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(account.id, isNew) }}
              />
              <input
                style={{ ...s.input, ...s.amountInput }}
                placeholder="יתרה"
                type="number"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(account.id, isNew) }}
              />
              <button style={s.actionBtn} onClick={commitEdit} title="שמור"><Check size={14} strokeWidth={2} /></button>
              <button style={{ ...s.actionBtn, color: 'var(--red)' }} onClick={() => cancelEdit(account.id, isNew)} title="בטל"><X size={14} strokeWidth={2} /></button>
            </div>
          )
        }

        return (
          <div
            key={account.id}
            style={{ ...s.row, background: isHovered ? 'var(--bg-primary)' : 'transparent' }}
            onMouseEnter={() => setHoveredRow(account.id)}
            onMouseLeave={() => { setHoveredRow(null); setHoveredField(null) }}
          >
            <span style={s.updatedAt}>{formatDate(account.updatedAt)}</span>
            <span
              style={{ ...s.name, ...(hoveredField === `${account.id}-name` ? s.fieldHover : {}) }}
              title="לחץ לעריכה"
              onMouseEnter={() => setHoveredField(`${account.id}-name`)}
              onMouseLeave={() => setHoveredField(null)}
              onClick={() => startEdit(account)}
            >
              {account.name || <span style={{ color: 'var(--text-faint)' }}>ללא שם</span>}
            </span>
            <span
              style={{ ...s.managedBy, ...(hoveredField === `${account.id}-managedBy` ? s.fieldHover : {}) }}
              title="לחץ לעריכה"
              onMouseEnter={() => setHoveredField(`${account.id}-managedBy`)}
              onMouseLeave={() => setHoveredField(null)}
              onClick={() => startEdit(account)}
            >
              {account.managedBy || '—'}
            </span>
            <span
              style={{ ...s.amount, ...(hoveredField === `${account.id}-amount` ? s.fieldHover : {}) }}
              title="לחץ לעריכה"
              onMouseEnter={() => setHoveredField(`${account.id}-amount`)}
              onMouseLeave={() => setHoveredField(null)}
              onClick={() => startEdit(account)}
            >
              {fmt(account.amount)}
            </span>
            <button
              style={{ ...s.actionBtn, opacity: isHovered ? 1 : 0, color: 'var(--red)', transition: 'opacity 0.15s' }}
              onClick={() => onDelete(account.id)}
              title="מחק"
              tabIndex={isHovered ? 0 : -1}
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </div>
        )
      })}

      {accounts.length > 0 && (
        <div style={s.totalRow}>
          <span style={s.totalLabel}>סה״כ חסכונות</span>
          <span style={s.totalAmount}>{fmt(total)}</span>
          {editingGoal ? (
            <span style={s.goalEditWrap}>
              <input
                ref={goalInputRef}
                style={s.goalInput}
                type="number"
                placeholder="סכום יעד"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitGoalEdit(); if (e.key === 'Escape') cancelGoalEdit() }}
              />
              <button style={s.goalSmallBtn} onClick={commitGoalEdit}><Check size={12} strokeWidth={2} /></button>
              <button style={{ ...s.goalSmallBtn, color: 'var(--red)' }} onClick={cancelGoalEdit}><X size={12} strokeWidth={2} /></button>
            </span>
          ) : (
            <button style={s.goalBtn} onClick={startGoalEdit}>
              {savingsGoal > 0 ? 'ערוך יעד' : 'הגדר יעד'}
            </button>
          )}
        </div>
      )}

      {savingsGoal > 0 && accounts.length > 0 && (() => {
        const pct = Math.min(Math.round((total / savingsGoal) * 100), 100)
        const reached = total >= savingsGoal
        const remaining = savingsGoal - total
        return (
          <div style={s.goalSection}>
            <div style={s.progressTrack}>
              <div style={{
                ...s.progressFill,
                width: `${pct}%`,
                ...(reached ? { background: 'var(--green)', boxShadow: '0 0 10px rgba(13,148,136,0.45)' } : {}),
              }} />
            </div>
            <div style={s.goalLabels}>
              <span style={s.goalText}>{fmt(total)} מתוך {fmt(savingsGoal)}</span>
              <span style={s.goalPct}>{pct}%</span>
            </div>
            <div style={s.goalRemaining}>
              {reached
                ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>הגעת ליעד!</span>
                : <span>נותרו {fmt(remaining)}</span>
              }
            </div>
          </div>
        )
      })()}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 4, direction: 'rtl' },
  empty: { color: 'var(--text-muted)', fontSize: 13, margin: '8px 0', textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 8, borderBottom: '1px solid var(--border)', transition: 'background 0.1s' },
  name: { flex: '2 1 0', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', borderRadius: 4, padding: '1px 3px' },
  managedBy: { flex: '2 1 0', fontSize: 13, color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', borderRadius: 4, padding: '1px 3px' },
  amount: { flex: '1 0 80px', fontSize: 14, fontWeight: 700, color: 'var(--green)', textAlign: 'left', cursor: 'text', borderRadius: 4, padding: '1px 3px' },
  fieldHover: { background: 'rgba(67,56,202,0.07)', outline: '1px solid rgba(67,56,202,0.2)', outlineOffset: 1 },
  updatedAt: { flex: '0 0 auto', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' },
  input: { flex: '2 1 0', fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 0, direction: 'rtl' },
  amountInput: { flex: '1 0 80px', textAlign: 'left', direction: 'ltr' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 },
  totalRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 6px 4px', borderTop: '2px solid var(--border)', marginTop: 4 },
  totalLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' },
  totalAmount: { fontSize: 15, fontWeight: 700, color: 'var(--green)', marginLeft: 'auto' },
  goalBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontFamily: 'inherit', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  goalEditWrap: { display: 'flex', alignItems: 'center', gap: 4 },
  goalInput: { width: 90, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-primary)', color: 'var(--text-primary)', direction: 'ltr' as const, textAlign: 'left' as const },
  goalSmallBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: 'var(--text-muted)', lineHeight: 1 },
  goalSection: { padding: '8px 6px 4px', display: 'flex', flexDirection: 'column' as const, gap: 6 },
  progressTrack: { width: '100%', height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' as const },
  progressFill: { height: '100%', background: 'var(--green)', borderRadius: 5, transition: 'width 0.4s ease, box-shadow 0.4s ease' },
  goalLabels: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  goalText: { fontSize: 12, color: 'var(--text-secondary)' },
  goalPct: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },
  goalRemaining: { fontSize: 12, color: 'var(--text-muted)' },
}
