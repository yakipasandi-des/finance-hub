import { useState } from 'react'
import { Trash2, Check, X, RotateCcw } from 'lucide-react'
import type { BankEntry } from '../types'

interface CashFlowTimelineProps {
  entries: BankEntry[]
  startingBalance: number
  projectionMonths: number
  onUpdateEntry: (id: string, changes: Partial<BankEntry>) => void
  onDeleteEntry: (id: string) => void
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function generateProjections(entries: BankEntry[], projectionMonths: number): BankEntry[] {
  const recurring = entries.filter((e) => e.recurring)
  if (recurring.length === 0) return []

  const today = new Date()
  const projections: BankEntry[] = []

  for (const entry of recurring) {
    const dayOfMonth = entry.date.getDate()

    for (let m = 0; m <= projectionMonths; m++) {
      const targetMonth = today.getMonth() + m
      const targetYear = today.getFullYear() + Math.floor(targetMonth / 12)
      const normalizedMonth = ((targetMonth % 12) + 12) % 12
      const day = Math.min(dayOfMonth, daysInMonth(targetYear, normalizedMonth))
      const projDate = new Date(targetYear, normalizedMonth, day)

      // Skip if a real entry already exists for same vendor in this month
      const monthStr = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`
      const alreadyExists = entries.some(
        (e) => e.vendor === entry.vendor &&
          monthKey(e.date) === monthStr &&
          !e.id.startsWith('proj_')
      )
      if (alreadyExists) continue

      // Past dates → בפועל, future dates → צפוי
      const isPast = projDate <= today

      projections.push({
        ...entry,
        id: `proj_${entry.id}_${m}`,
        date: projDate,
        status: isPast ? 'actual' : 'expected',
        source: entry.source,
      })
    }
  }

  return projections
}

export function CashFlowTimeline({
  entries,
  startingBalance,
  projectionMonths,
  onUpdateEntry,
  onDeleteEntry,
}: CashFlowTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<BankEntry>>({})
  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc')

  // Generate projections and merge with actual entries
  const projections = generateProjections(entries, projectionMonths)
  const allEntries = [...entries, ...projections]
  allEntries.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Compute running balance (always oldest-first)
  let runningBalance = startingBalance
  const rows = allEntries.map((entry) => {
    runningBalance += entry.receipt - entry.payment
    return { entry, balance: runningBalance }
  })

  const isProjection = (id: string) => id.startsWith('proj_')

  function startEdit(entry: BankEntry) {
    if (isProjection(entry.id)) return
    setEditingId(entry.id)
    setEditDraft({
      date: entry.date,
      vendor: entry.vendor,
      category: entry.category,
      payment: entry.payment,
      receipt: entry.receipt,
      status: entry.status,
      recurring: entry.recurring,
    })
  }

  function saveEdit() {
    if (!editingId) return
    onUpdateEntry(editingId, editDraft)
    setEditingId(null)
    setEditDraft({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  // Sort for display
  const displayRows = dateSort === 'desc' ? [...rows].reverse() : rows
  let lastMonth = ''

  return (
    <div style={s.wrapper}>
      <div style={s.tableScroll}>
        <table style={s.table}>
          <thead>
            <tr>
              <th
                style={s.thSortable}
                onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
              >
                תאריך {dateSort === 'desc' ? '▼' : '▲'}
              </th>
              <th style={s.th}>סטטוס</th>
              <th style={s.th}>סוג</th>
              <th style={s.th}>שם</th>
              <th style={s.th}>קבוע</th>
              <th style={{ ...s.th, textAlign: 'left' }}>תשלום</th>
              <th style={{ ...s.th, textAlign: 'left' }}>תקבול</th>
              <th style={{ ...s.th, textAlign: 'left' }}>מצטבר</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ entry, balance }) => {
              const mk = monthKey(entry.date)
              const showMonthSep = mk !== lastMonth
              lastMonth = mk

              const isProj = isProjection(entry.id)
              const isEditing = editingId === entry.id

              return [
                showMonthSep && (
                  <tr key={`sep-${mk}`}>
                    <td colSpan={9} style={s.monthSep}>
                      {HEBREW_MONTHS[entry.date.getMonth()]} {entry.date.getFullYear()}
                    </td>
                  </tr>
                ),
                <tr
                  key={entry.id}
                  style={{
                    ...s.row,
                    ...(isProj ? s.projectedRow : {}),
                    ...(isEditing ? s.editingRow : {}),
                    cursor: isProj ? 'default' : 'pointer',
                  }}
                  onClick={() => !isEditing && startEdit(entry)}
                >
                  <td style={s.td}>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editDraft.date ? formatDateInput(editDraft.date) : ''}
                        onChange={(e) => setEditDraft({ ...editDraft, date: new Date(e.target.value) })}
                        style={s.editInput}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      entry.date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    )}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <select
                        value={editDraft.status ?? entry.status}
                        onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as 'actual' | 'expected' })}
                        style={s.editInput}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="actual">בפועל</option>
                        <option value="expected">צפוי</option>
                      </select>
                    ) : (() => {
                      const effectiveStatus = entry.date <= new Date() ? 'actual' : entry.status
                      return (
                        <span style={{ ...s.statusBadge, ...(effectiveStatus === 'actual' ? s.statusActual : s.statusExpected) }}>
                          {effectiveStatus === 'actual' ? 'בפועל' : 'צפוי'}
                        </span>
                      )
                    })()}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input
                        value={editDraft.category ?? ''}
                        onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                        style={s.editInput}
                        placeholder="סוג..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span style={s.category}>{entry.category}</span>
                    )}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input
                        value={editDraft.vendor ?? ''}
                        onChange={(e) => setEditDraft({ ...editDraft, vendor: e.target.value })}
                        style={s.editInput}
                        placeholder="שם..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      entry.vendor
                    )}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {!isProj && (
                      <RotateCcw
                        size={15}
                        strokeWidth={1.75}
                        style={{
                          color: entry.recurring ? 'var(--accent)' : 'var(--text-muted)',
                          opacity: entry.recurring ? 1 : 0.35,
                          cursor: 'pointer',
                          transition: 'color 0.15s, opacity 0.15s',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onUpdateEntry(entry.id, { recurring: !entry.recurring })
                        }}
                      />
                    )}
                  </td>
                  <td style={{ ...s.td, ...s.amountPayment }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editDraft.payment ?? 0}
                        onChange={(e) => setEditDraft({ ...editDraft, payment: parseFloat(e.target.value) || 0 })}
                        style={{ ...s.editInput, width: 80 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      entry.payment > 0 ? fmt(entry.payment) : ''
                    )}
                  </td>
                  <td style={{ ...s.td, ...s.amountReceipt }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editDraft.receipt ?? 0}
                        onChange={(e) => setEditDraft({ ...editDraft, receipt: parseFloat(e.target.value) || 0 })}
                        style={{ ...s.editInput, width: 80 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      entry.receipt > 0 ? fmt(entry.receipt) : ''
                    )}
                  </td>
                  <td style={{ ...s.td, fontWeight: 600, color: balance >= 0 ? 'var(--green)' : 'var(--red)', textAlign: 'left' }}>
                    {fmt(balance)}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button style={s.iconBtn} onClick={saveEdit} title="שמור"><Check size={14} color="var(--green)" /></button>
                        <button style={s.iconBtn} onClick={cancelEdit} title="ביטול"><X size={14} color="var(--red)" /></button>
                        <button style={s.iconBtn} onClick={() => { onDeleteEntry(entry.id); setEditingId(null) }} title="מחק"><Trash2 size={14} /></button>
                      </div>
                    ) : (
                      null
                    )}
                  </td>
                </tr>,
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 12 },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, direction: 'rtl' },
  th: {
    padding: '10px 12px',
    textAlign: 'right',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  thSortable: {
    padding: '10px 12px',
    textAlign: 'right',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  row: {
    transition: 'background 0.1s',
  },
  projectedRow: {
    opacity: 0.7,
    borderRight: '3px dashed var(--accent)',
  },
  editingRow: {
    background: 'var(--accent-fill)',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
  },
  monthSep: {
    padding: '10px 12px 6px',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
    background: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border)',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  statusActual: {
    background: 'var(--green-fill)',
    color: 'var(--green)',
  },
  statusExpected: {
    background: 'var(--yellow-fill)',
    color: 'var(--yellow)',
  },
  category: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  amountPayment: {
    color: 'var(--red)',
    textAlign: 'left' as const,
    fontWeight: 500,
  },
  amountReceipt: {
    color: 'var(--green)',
    textAlign: 'left' as const,
    fontWeight: 500,
  },
  editInput: {
    padding: '4px 8px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: 12,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    direction: 'rtl',
    outline: 'none',
    maxWidth: 120,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    lineHeight: 1,
    borderRadius: 4,
  },
}
