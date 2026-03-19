import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { CategoryChip } from './CategoryChip'
import { useFilters } from '../context/FilterContext'

interface TransactionTableProps {
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
  recurringMerchants: Set<string>
  toggleRecurring: (merchant: string) => void
}

function formatAmount(n: number): string {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export function TransactionTable({ map, setMapping, recurringMerchants, toggleRecurring }: TransactionTableProps) {
  const { filteredTransactions } = useFilters()
  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc')
  const sorted = [...filteredTransactions].sort((a, b) =>
    dateSort === 'desc' ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime()
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th
              style={styles.thSortable}
              onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
            >
              תאריך {dateSort === 'desc' ? '▼' : '▲'}
            </th>
            {['בית עסק', 'קטגוריה', 'פירוט', 'קבוע', 'סכום'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((tx, i) => (
            <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
              <td style={styles.td}>
                {tx.date.toLocaleDateString('he-IL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                })}
              </td>
              <td style={{ ...styles.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.merchant}
              </td>
              <td style={styles.td}>
                <CategoryChip merchant={tx.merchant} map={map} setMapping={setMapping} />
              </td>
              <td style={styles.td}>
                {tx.notes && <NoteBadge notes={tx.notes} />}
              </td>
              <td style={{ ...styles.td, textAlign: 'center' }}>
                {(() => {
                  const autoDetected = tx.notes === 'הוראת קבע' || (tx.notes?.includes('תשלום') ?? false)
                  const inSet = recurringMerchants.has(tx.merchant)
                  // For auto-detected: inSet means user excluded it. For manual: inSet means user included it.
                  const active = autoDetected ? !inSet : inSet
                  return (
                    <RotateCcw
                      size={15}
                      strokeWidth={1.75}
                      style={{
                        color: active ? 'var(--accent)' : 'var(--text-muted)',
                        opacity: active ? 1 : 0.35,
                        cursor: 'pointer',
                        transition: 'color 0.15s, opacity 0.15s',
                      }}
                      onClick={() => toggleRecurring(tx.merchant)}
                    />
                  )
                })()}
              </td>
              <td style={{ ...styles.td, fontWeight: 600, textAlign: 'left', direction: 'ltr' }}>
                {formatAmount(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NoteBadge({ notes }: { notes: string }) {
  const isRecurring = notes === 'הוראת קבע'
  const isInstallment = notes.includes('תשלום')
  const color = isRecurring ? '#6ab3d8' : isInstallment ? '#9b8bd4' : '#8e85a8'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      background: color + '18',
      color,
    }}>
      {notes}
    </span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    direction: 'rtl',
    fontSize: '13px',
  },
  th: {
    textAlign: 'right',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  thSortable: {
    textAlign: 'right',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  td: {
    padding: '8px 12px',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  },
  rowEven: { background: 'transparent' },
  rowOdd: { background: 'var(--bg-primary)' },
}
