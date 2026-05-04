import { useState, useEffect, useRef } from 'react'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import type { Transaction } from '../types'
import { useCategories } from '../context/CategoriesContext'
import { useTopExpenses } from '../hooks/useTopExpenses'
import { CategoryIcon } from '../icons'

interface TopExpensesCardProps {
  transactions: Transaction[]
  allTransactions: Transaction[]
  map: Record<string, string>
  budgets: Record<string, number>
  recurringMerchants: Set<string>
  selectedMonths: string[]
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

const TOP_N_OPTIONS = [3, 5, 10] as const

export function TopExpensesCard({
  transactions,
  allTransactions,
  map,
  budgets,
  recurringMerchants,
  selectedMonths,
}: TopExpensesCardProps) {
  const { categories } = useCategories()
  const [topN, setTopN] = useState<number>(5)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [mounted, setMounted] = useState<boolean[]>([])
  const prevKeyRef = useRef('')
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const { items, maxAmount } = useTopExpenses({
    transactions,
    allTransactions,
    map,
    categories,
    budgets,
    recurringMerchants,
    selectedMonths,
    topN,
  })

  // Staggered entrance animation
  useEffect(() => {
    const key = items.map((i) => i.merchant).join('|')
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setMounted([])
    items.forEach((_, idx) => {
      timersRef.current.push(setTimeout(() => {
        setMounted((prev) => {
          const next = [...prev]
          next[idx] = true
          return next
        })
      }, idx * 60))
    })
  }, [items])

  if (items.length === 0) {
    return <p style={s.empty}>אין נתוני הוצאות להצגה</p>
  }

  return (
    <div style={s.wrapper}>
      {/* Top N selector */}
      <div style={s.selectorRow}>
        {TOP_N_OPTIONS.map((n) => (
          <button
            key={n}
            style={{ ...s.pill, ...(topN === n ? s.pillActive : {}) }}
            onClick={() => setTopN(n)}
          >
            Top {n}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div style={s.list}>
        {items.map((item, idx) => {
          const isFirst = idx === 0
          const isHovered = hoveredIdx === idx
          return (
            <div
              key={item.merchant}
              style={{
                ...s.row,
                ...(isFirst ? s.firstRow : {}),
                ...(isHovered ? s.rowHover : {}),
                opacity: mounted[idx] ? 1 : 0,
                transform: mounted[idx] ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.3s ease, transform 0.3s ease, background 0.15s',
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={undefined}
            >
              {/* Rank */}
              <span style={s.rank}>#{idx + 1}</span>

              {/* Main info */}
              <div style={s.mainCol}>
                <div style={s.merchantRow}>
                  <span style={{ ...s.merchant, ...(isFirst ? { fontSize: 14 } : {}) }}>
                    {item.merchant}
                  </span>
                  <div style={s.badges}>
                    {item.isRecurring && (
                      <RotateCcw size={11} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    )}
                    {item.isOverBudget && (
                      <AlertTriangle size={11} strokeWidth={2} style={{ color: 'var(--red)', flexShrink: 0 }} />
                    )}
                  </div>
                </div>
                {/* Category badge */}
                <span
                  style={{
                    ...s.catBadge,
                    background: item.categoryColor + '18',
                    color: item.categoryColor,
                    borderColor: item.categoryColor + '44',
                  }}
                >
                  <CategoryIcon icon={item.categoryIcon} size={10} />
                  {item.categoryName}
                </span>
                {/* Frequency tag */}
                <span style={{
                  ...s.freqTag,
                  ...(item.monthsAppeared === item.totalMonths && item.totalMonths > 1 ? s.freqMonthly : {}),
                }}>
                  {item.monthsAppeared === 1 ? 'חד פעמי'
                    : item.monthsAppeared === item.totalMonths ? 'חודשי'
                    : `${item.monthsAppeared} מתוך ${item.totalMonths} חודשים`}
                </span>
              </div>

              {/* Amount + % */}
              <div style={s.amountCol}>
                <span style={{ ...s.amount, ...(isFirst ? { fontSize: 15 } : {}) }}>
                  {fmt(item.amount)}
                </span>
                <span style={s.pct}>{item.pctOfTotal.toFixed(1)}%</span>
                {item.monthlyAvg != null && (
                  <span style={s.avgLabel}>ממוצע: {fmt(item.monthlyAvg)}/חודש</span>
                )}
              </div>

              {/* Progress bar */}
              <div style={s.barContainer}>
                <div
                  style={{
                    ...s.barFill,
                    width: maxAmount > 0 ? `${(item.amount / maxAmount) * 100}%` : '0%',
                    background: item.isOverBudget ? 'var(--red)' : item.categoryColor,
                  }}
                />
              </div>

              {/* Period change */}
              <div style={s.changeCol}>
                {item.periodChange != null ? (
                  <span style={{
                    ...s.change,
                    color: item.periodChange > 0 ? 'var(--red)' : item.periodChange < 0 ? 'var(--green)' : 'var(--text-muted)',
                  }}>
                    {item.periodChange > 0 ? '↑' : item.periodChange < 0 ? '↓' : '→'}
                    {Math.abs(item.periodChange).toFixed(0)}%
                  </span>
                ) : selectedMonths.length > 0 ? (
                  <span style={s.newBadge}>חדש</span>
                ) : null}
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div style={s.tooltip}>
                  <div style={s.tooltipRow}><strong>{item.merchant}</strong></div>
                  <div style={s.tooltipRow}>{item.categoryName} — סה״כ בקטגוריה: {fmt(item.categoryTotal)}</div>
                  <div style={s.tooltipRow}>סכום: {fmt(item.amount)}</div>
                  {item.periodChange != null && (
                    <div style={s.tooltipRow}>
                      שינוי מתקופה קודמת: {item.periodChange > 0 ? '+' : ''}{item.periodChange.toFixed(1)}%
                    </div>
                  )}
                  <div style={s.tooltipRow}>הופיע ב-{item.monthsAppeared} מתוך {item.totalMonths} חודשים</div>
                  {item.monthlyAvg != null && (
                    <div style={s.tooltipRow}>ממוצע חודשי: {fmt(item.monthlyAvg)}</div>
                  )}
                  {item.isRecurring && <div style={s.tooltipRow}>הוצאה חוזרת</div>}
                  {item.isOverBudget && <div style={{ ...s.tooltipRow, color: 'var(--red)' }}>חריגה מתקציב!</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '32px 0' },
  selectorRow: {
    display: 'flex',
    gap: 4,
    justifyContent: 'flex-start',
  },
  pill: {
    padding: '4px 12px',
    border: '1px solid var(--border)',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  pillActive: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' as const },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'default',
    position: 'relative' as const,
    direction: 'rtl' as const,
  },
  firstRow: {
    background: 'var(--accent-fill)',
  },
  rowHover: {
    background: 'var(--bg-primary)',
    zIndex: 10,
  },
  rank: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-faint)',
    minWidth: 24,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  mainCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    minWidth: 0,
  },
  merchantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  merchant: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  catBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 8px',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 600,
    border: '1px solid',
    whiteSpace: 'nowrap' as const,
    width: 'fit-content',
  },
  freqTag: {
    fontSize: 9,
    fontWeight: 600,
    color: 'var(--text-faint)',
    background: 'var(--bg-primary)',
    padding: '1px 6px',
    borderRadius: 8,
    width: 'fit-content',
  },
  freqMonthly: {
    color: 'var(--green)',
    background: 'var(--green-fill)',
  },
  avgLabel: {
    fontSize: 9,
    color: 'var(--text-faint)',
  },
  amountCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const,
    gap: 1,
    flexShrink: 0,
    minWidth: 65,
  },
  amount: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  pct: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  barContainer: {
    width: 60,
    height: 4,
    background: 'var(--border)',
    borderRadius: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  changeCol: {
    minWidth: 44,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  change: {
    fontSize: 11,
    fontWeight: 600,
  },
  newBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--accent)',
    background: 'var(--accent-fill)',
    padding: '2px 6px',
    borderRadius: 8,
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: 'calc(100% + 6px)',
    right: 12,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 200,
    pointerEvents: 'none' as const,
    direction: 'rtl' as const,
    minWidth: 200,
    fontSize: 12,
  },
  tooltipRow: {
    padding: '2px 0',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap' as const,
  },
}
