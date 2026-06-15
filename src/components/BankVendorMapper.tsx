import { useState } from 'react'
import type { BankEntry } from '../types'
import { CategorySelect } from './CategorySelect'

interface BankVendorMapperProps {
  bankEntries: BankEntry[]
  bankCategoryMap: Record<string, string>
  setBankMapping: (vendor: string, categoryId: string | null) => void
}

type MapFilter = 'all' | 'mapped' | 'unmapped'

function formatAmount(n: number): string {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

export function BankVendorMapper({ bankEntries, bankCategoryMap, setBankMapping }: BankVendorMapperProps) {
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')

  // Aggregate bank expense rows (payment > 0) by vendor
  const totals: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const e of bankEntries) {
    if (e.payment <= 0 || !e.vendor) continue
    totals[e.vendor] = (totals[e.vendor] ?? 0) + e.payment
    counts[e.vendor] = (counts[e.vendor] ?? 0) + 1
  }

  const allVendors = Object.entries(totals).sort(([, a], [, b]) => b - a)
  const mapped = allVendors.filter(([v]) => bankCategoryMap[v]).length
  const coveragePct = allVendors.length > 0 ? Math.round((mapped / allVendors.length) * 100) : 0

  const vendors = allVendors.filter(([v]) => {
    if (mapFilter === 'mapped') return !!bankCategoryMap[v]
    if (mapFilter === 'unmapped') return !bankCategoryMap[v]
    return true
  })

  if (allVendors.length === 0) {
    return (
      <p style={styles.empty}>
        אין הוצאות בנק לשיוך. ייבא קובץ בנק בלשונית תזרים המזומנים — הספקים יופיעו כאן לשיוך לקטגוריה אחת שתחול על כל השורות שלהם.
      </p>
    )
  }

  return (
    <div>
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {([
            ['all', 'הכל'],
            ['mapped', 'ממופה'],
            ['unmapped', 'לא ממופה'],
          ] as [MapFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMapFilter(id)}
              style={{ ...styles.filterBtn, ...(mapFilter === id ? styles.filterActive : {}) }}
            >
              {id === 'mapped' && <span style={{ ...styles.dot, background: 'var(--green)' }} />}
              {id === 'unmapped' && <span style={{ ...styles.dot, background: 'var(--border)', border: '1px solid var(--text-faint)' }} />}
              {label}
            </button>
          ))}
        </div>
        <span style={styles.coverage}>
          {mapped} מתוך {allVendors.length} ממופים ({coveragePct}%)
        </span>
      </div>

      <div style={styles.list}>
        {vendors.map(([vendor, total]) => {
          const catId = bankCategoryMap[vendor]
          return (
            <div key={vendor} style={styles.row}>
              <span style={{ ...styles.dot, background: catId ? 'var(--green)' : 'var(--border)', border: catId ? 'none' : '1px solid var(--text-faint)', flexShrink: 0 }} />
              <div style={styles.merchantInfo}>
                <span style={styles.merchantName}>{vendor}</span>
                <span style={styles.merchantMeta}>{counts[vendor] ?? 0} תנועות</span>
              </div>
              <span style={styles.amount}>{formatAmount(total)}</span>
              <CategorySelect value={catId} onChange={(id) => setBankMapping(vendor, id)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  empty: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, flexWrap: 'wrap', gap: 8, direction: 'rtl',
  },
  dot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%' },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', border: '1px solid transparent', borderRadius: 7,
    background: 'transparent', color: 'var(--text-muted)',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
  },
  filterActive: {
    background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 700, border: '1px solid var(--border)',
  },
  coverage: { fontSize: 13, fontWeight: 600, color: 'var(--accent)' },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    background: 'var(--bg-primary)', borderRadius: 10, direction: 'rtl',
  },
  merchantInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' },
  merchantName: {
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  merchantMeta: { fontSize: 11, color: 'var(--text-faint)' },
  amount: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, width: 80, textAlign: 'left' },
}
