import { useState } from 'react'
import { Trash2, Check, X, CreditCard } from 'lucide-react'
import type { CreditCardPayment } from '../types'
import { HelpTooltip } from './HelpTooltip'
import { useColumnResize } from '../hooks/useColumnResize'
import { ResizeColHandle } from './ResizeColHandle'

interface CreditCardBoxProps {
  payments: CreditCardPayment[]
  onAdd: (date?: Date, amount?: number) => string
  onUpdate: (id: string, changes: Partial<Omit<CreditCardPayment, 'id'>>) => void
  onDelete: (id: string) => void
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function CreditCardBox({ payments, onAdd, onUpdate, onDelete }: CreditCardBoxProps) {
  const colResize = useColumnResize('finance-hub-cc-col-widths', [120, 100, 60])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const sorted = [...payments].sort((a, b) => a.date.getTime() - b.date.getTime())

  // Find next upcoming payment
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const nextUpcoming = sorted.find((p) => p.date >= now)

  function startEdit(p: CreditCardPayment) {
    setEditingId(p.id)
    setEditDate(toInputDate(p.date))
    setEditAmount(String(p.amount))
  }

  function commitEdit() {
    if (!editingId) return
    const date = editDate ? new Date(editDate + 'T00:00:00') : undefined
    const amount = parseFloat(editAmount) || 0
    onUpdate(editingId, { ...(date ? { date } : {}), amount })
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleAdd() {
    const id = onAdd()
    setEditingId(id)
    setEditDate(toInputDate(new Date()))
    setEditAmount('')
  }

  return (
    <div style={s.box}>
      <div style={s.header}>
        <span style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, userSelect: 'none' as const, flexShrink: 0 }} title="גרור לשינוי סדר">⠿</span>
        <CreditCard size={18} style={{ color: 'var(--accent)' }} />
        <h3 style={s.title}>חיוב אשראי <HelpTooltip text="סכומי חיוב כרטיס אשראי צפויים — מופיעים כתשלום בתזרים המזומנים" /></h3>
        <button style={s.addBtn} onClick={handleAdd}>+ הוסף</button>
      </div>

      {sorted.length === 0 ? (
        <p style={s.empty}>אין תשלומים. הוסף את סכום החיוב הקרוב בכרטיס האשראי.</p>
      ) : (
        <table style={{ ...s.table, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...s.th, ...colResize.thStyle(0) }}>
                תאריך
                <ResizeColHandle handleStyle={colResize.handleStyle} lineStyle={colResize.handleLineStyle} lineHoverStyle={colResize.handleLineHoverStyle} onMouseDown={(e) => colResize.onMouseDown(0, e)} />
              </th>
              <th style={{ ...s.th, ...colResize.thStyle(1) }}>
                סכום (₪)
                <ResizeColHandle handleStyle={colResize.handleStyle} lineStyle={colResize.handleLineStyle} lineHoverStyle={colResize.handleLineHoverStyle} onMouseDown={(e) => colResize.onMouseDown(1, e)} />
              </th>
              <th style={{ ...s.th, ...colResize.thStyle(2) }}>
                <ResizeColHandle handleStyle={colResize.handleStyle} lineStyle={colResize.handleLineStyle} lineHoverStyle={colResize.handleLineHoverStyle} onMouseDown={(e) => colResize.onMouseDown(2, e)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const isEditing = editingId === p.id
              const isNext = nextUpcoming?.id === p.id
              return (
                <tr
                  key={p.id}
                  style={{
                    background: isNext ? 'rgba(67, 56, 202, 0.06)' : undefined,
                    cursor: isEditing ? undefined : 'pointer',
                  }}
                  onClick={() => { if (!isEditing) startEdit(p) }}
                >
                  <td style={s.td}>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        style={s.input}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
                        autoFocus
                      />
                    ) : (
                      <span style={isNext ? s.nextLabel : undefined}>
                        {p.date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {isNext && <span style={s.badge}>הבא</span>}
                      </span>
                    )}
                  </td>
                  <td style={{ ...s.td, fontWeight: 600, color: 'var(--red)' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        style={{ ...s.input, width: 100 }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                      />
                    ) : (
                      fmt(p.amount)
                    )}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <span style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button style={s.iconBtn} onClick={commitEdit} title="שמור">
                          <Check size={14} />
                        </button>
                        <button style={s.iconBtn} onClick={cancelEdit} title="ביטול">
                          <X size={14} />
                        </button>
                      </span>
                    ) : (
                      <button
                        style={{ ...s.iconBtn, color: 'var(--red)' }}
                        onClick={() => onDelete(p.id)}
                        title="מחק"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  box: {
    direction: 'rtl',
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  addBtn: {
    marginRight: 'auto',
    padding: '6px 16px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 13,
    textAlign: 'center',
    padding: '12px 0',
    margin: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'right',
    padding: '6px 10px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: 12,
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
  input: {
    padding: '4px 8px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: 13,
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    direction: 'rtl',
    outline: 'none',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    color: 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  nextLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    background: 'var(--accent)',
    color: '#fff',
    padding: '1px 7px',
    borderRadius: 10,
  },
}
