import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { Transaction } from '../types'
import { useCategories } from '../context/CategoriesContext'
import { CategoryIcon } from '../icons'

interface MerchantMapperProps {
  transactions: Transaction[]
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
}

function formatAmount(n: number): string {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

// ---------------------------------------------------------------------------
// Custom category dropdown (replaces <select> so icons can render)
// ---------------------------------------------------------------------------
function CategorySelect({
  catId,
  merchant,
  setMapping,
}: {
  catId: string | undefined
  merchant: string
  setMapping: (merchant: string, categoryId: string | null) => void
}) {
  const { categories } = useCategories()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cat = categories.find((c) => c.id === catId)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const triggerBg = cat ? cat.color + '18' : 'var(--bg-surface)'
  const triggerColor = cat ? cat.color : 'var(--text-muted)'
  const triggerBorder = cat ? cat.color + '44' : 'var(--border)'

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, width: 180 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px',
          border: `1px solid ${triggerBorder}`,
          borderRadius: 8,
          background: triggerBg,
          color: triggerColor,
          fontSize: 12,
          fontFamily: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          direction: 'rtl',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {cat ? <CategoryIcon icon={cat.icon} size={13} /> : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cat ? cat.name : 'ללא קטגוריה'}
          </span>
        </span>
        <ChevronDown size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 200, padding: 6,
          display: 'flex', flexDirection: 'column', gap: 2,
          direction: 'rtl',
        }}>
          {catId && (
            <button
              onClick={() => { setMapping(merchant, null); setOpen(false) }}
              style={optStyle('var(--text-muted)')}
            >
              <X size={11} strokeWidth={2} /> הסר קטגוריה
            </button>
          )}
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => { setMapping(merchant, c.id); setOpen(false) }}
              style={{ ...optStyle(c.color), background: catId === c.id ? c.color + '22' : 'transparent' }}
            >
              <CategoryIcon icon={c.icon} size={13} /> {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function optStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', textAlign: 'right',
    padding: '7px 10px', border: 'none', borderRadius: 6,
    background: 'transparent', color,
    fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
    cursor: 'pointer',
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MerchantMapper({ transactions, map, setMapping }: MerchantMapperProps) {
  const merchantTotals = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.merchant] = (acc[tx.merchant] ?? 0) + tx.amount
    return acc
  }, {})
  const merchantCounts = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.merchant] = (acc[tx.merchant] ?? 0) + 1
    return acc
  }, {})

  const merchants = Object.entries(merchantTotals).sort(([, a], [, b]) => b - a)
  const mapped = merchants.filter(([m]) => map[m]).length
  const coveragePct = merchants.length > 0 ? Math.round((mapped / merchants.length) * 100) : 0

  return (
    <div>
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={styles.legend}><span style={{ ...styles.dot, background: 'var(--green)' }} /> ממופה</span>
          <span style={styles.legend}><span style={{ ...styles.dot, background: 'var(--border)', border: '1px solid var(--text-faint)' }} /> לא ממופה</span>
        </div>
        <span style={styles.coverage}>
          {mapped} מתוך {merchants.length} ממופים ({coveragePct}%)
        </span>
      </div>

      <div style={styles.list}>
        {merchants.map(([merchant, total]) => {
          const catId = map[merchant]
          const txCount = merchantCounts[merchant] ?? 0

          return (
            <div key={merchant} style={styles.row}>
              <span style={{ ...styles.dot, background: catId ? 'var(--green)' : 'var(--border)', border: catId ? 'none' : '1px solid var(--text-faint)', flexShrink: 0 }} />

              <div style={styles.merchantInfo}>
                <span style={styles.merchantName}>{merchant}</span>
                <span style={styles.merchantMeta}>{txCount} עסקאות</span>
              </div>

              <span style={styles.amount}>{formatAmount(total)}</span>

              <CategorySelect catId={catId} merchant={merchant} setMapping={setMapping} />
            </div>
          )
        })}
      </div>
    </div>
  )
}


const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, flexWrap: 'wrap', gap: 8, direction: 'rtl',
  },
  legend: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--text-muted)',
  },
  dot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
  },
  coverage: { fontSize: 13, fontWeight: 600, color: 'var(--accent)' },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    background: 'var(--bg-primary)', borderRadius: 10, direction: 'rtl',
  },
  merchantInfo: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden',
  },
  merchantName: {
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  merchantMeta: { fontSize: 11, color: 'var(--text-faint)' },
  amount: {
    fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
    flexShrink: 0, width: 80, textAlign: 'left',
  },
}
