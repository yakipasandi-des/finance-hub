import { useState, useMemo } from 'react'
import { Wand2 } from 'lucide-react'
import type { Transaction } from '../types'
import { autoSuggest, getChildCategories } from '../categories'
import { useCategories } from '../context/CategoriesContext'
import { CategoryFilterDropdown, type CategoryFilterOption } from './CategoryFilterDropdown'
import { CategorySelect } from './CategorySelect'

interface MerchantMapperProps {
  transactions: Transaction[]
  map: Record<string, string>
  setMapping: (merchant: string, categoryId: string | null) => void
}

function formatAmount(n: number): string {
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type MapFilter = 'all' | 'mapped' | 'unmapped'

export function MerchantMapper({ transactions, map, setMapping }: MerchantMapperProps) {
  const { categories } = useCategories()
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')
  const [catFilter, setCatFilter] = useState<string[]>([])

  const merchantTotals = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.merchant] = (acc[tx.merchant] ?? 0) + tx.amount
    return acc
  }, {})
  const merchantCounts = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.merchant] = (acc[tx.merchant] ?? 0) + 1
    return acc
  }, {})

  const [autoMapCount, setAutoMapCount] = useState<number | null>(null)

  const allMerchants = Object.entries(merchantTotals).sort(([, a], [, b]) => b - a)
  const mapped = allMerchants.filter(([m]) => map[m]).length
  const unmappedCount = allMerchants.length - mapped
  const coveragePct = allMerchants.length > 0 ? Math.round((mapped / allMerchants.length) * 100) : 0

  // Category-filter options: one entry per category that has ≥1 merchant mapped
  // to it (flat, with merchant counts) — mirrors the global filter's behavior.
  const categoryOptions = useMemo<CategoryFilterOption[]>(() => {
    const counts: Record<string, number> = {}
    for (const [m] of allMerchants) {
      const id = map[m]
      if (id) counts[id] = (counts[id] ?? 0) + 1
    }
    return categories
      .filter((c) => (counts[c.id] ?? 0) > 0)
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, count: counts[c.id] }))
  }, [allMerchants, map, categories])

  // Selecting a parent category also matches its sub-categories (same as the
  // global filter's parent→children expansion).
  const catFilterSet = useMemo(() => {
    if (catFilter.length === 0) return null
    const set = new Set(catFilter)
    for (const id of catFilter) {
      for (const child of getChildCategories(id, categories)) set.add(child.id)
    }
    return set
  }, [catFilter, categories])

  const merchants = allMerchants.filter(([m]) => {
    if (mapFilter === 'mapped' && !map[m]) return false
    if (mapFilter === 'unmapped' && map[m]) return false
    if (catFilterSet && !catFilterSet.has(map[m] ?? '')) return false
    return true
  })

  function handleAutoMap() {
    // Tokenize a merchant name into meaningful words (length >= 2)
    const tokenize = (name: string) =>
      name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((w) => w.length >= 2)

    // Build a word→category index from existing mappings
    const wordCatScores: Record<string, Record<string, number>> = {}
    for (const [merchant] of allMerchants) {
      const catId = map[merchant]
      if (!catId) continue
      for (const word of tokenize(merchant)) {
        if (!wordCatScores[word]) wordCatScores[word] = {}
        wordCatScores[word][catId] = (wordCatScores[word][catId] ?? 0) + 1
      }
    }

    let count = 0
    for (const [merchant] of allMerchants) {
      if (map[merchant]) continue

      // 1. Try hardcoded rules first
      const ruleMatch = autoSuggest(merchant)
      if (ruleMatch) {
        setMapping(merchant, ruleMatch)
        count++
        continue
      }

      // 2. Score by shared words with mapped merchants
      const words = tokenize(merchant)
      if (words.length === 0) continue

      const catScores: Record<string, number> = {}
      for (const word of words) {
        const scores = wordCatScores[word]
        if (!scores) continue
        for (const [catId, freq] of Object.entries(scores)) {
          // Weight longer words more — they're more distinctive
          catScores[catId] = (catScores[catId] ?? 0) + freq * word.length
        }
      }

      const best = Object.entries(catScores).sort(([, a], [, b]) => b - a)[0]
      if (best && best[1] >= 3) {
        setMapping(merchant, best[0])
        count++
      }
    }

    setAutoMapCount(count)
    setTimeout(() => setAutoMapCount(null), 3000)
  }

  return (
    <div>
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
          {categoryOptions.length > 0 && (
            <CategoryFilterDropdown
              options={categoryOptions}
              selected={catFilter}
              onToggle={(id) => setCatFilter((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])}
              onSelectAll={() => setCatFilter(categoryOptions.map((c) => c.id))}
              onClear={() => setCatFilter([])}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {autoMapCount !== null && (
            <span style={styles.autoMapResult}>
              {autoMapCount > 0 ? `מופו ${autoMapCount} בתי עסק` : 'לא נמצאו התאמות חדשות'}
            </span>
          )}
          {unmappedCount > 0 && (
            <button style={styles.autoMapBtn} onClick={handleAutoMap}>
              <Wand2 size={13} strokeWidth={2} /> מפה אוטומטית
            </button>
          )}
          <span style={styles.coverage}>
            {mapped} מתוך {allMerchants.length} ממופים ({coveragePct}%)
          </span>
        </div>
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

              <CategorySelect value={catId} onChange={(id) => setMapping(merchant, id)} />
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
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', border: '1px solid transparent', borderRadius: 7,
    background: 'transparent', color: 'var(--text-muted)',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
  },
  filterActive: {
    background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 700, border: '1px solid var(--border)',
  },
  autoMapBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 14px', border: '1px solid var(--accent)',
    borderRadius: 8, background: 'var(--accent)',
    color: '#fff', fontSize: 12, fontFamily: 'inherit',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  },
  autoMapResult: {
    fontSize: 12, fontWeight: 600, color: 'var(--green)',
    whiteSpace: 'nowrap' as const,
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
