import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Wand2 } from 'lucide-react'
import type { Transaction } from '../types'
import { autoSuggest, buildCategoryTree } from '../categories'
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
  const [expandedParent, setExpandedParent] = useState<string | null>(null)
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
          direction: 'ltr',
          maxHeight: 320, overflowY: 'auto',
        }}>
        <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {catId && (
            <button
              onClick={() => { setMapping(merchant, null); setOpen(false) }}
              style={optStyle('var(--text-muted)')}
            >
              <X size={11} strokeWidth={2} /> הסר קטגוריה
            </button>
          )}
          {buildCategoryTree(categories).map((node) => {
            const hasChildren = node.children.length > 0
            const isExpanded = expandedParent === node.parent.id
            return (
              <div key={node.parent.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <button
                    onClick={() => { setMapping(merchant, node.parent.id); setOpen(false) }}
                    style={{ ...optStyle(node.parent.color), background: catId === node.parent.id ? node.parent.color + '22' : 'transparent', fontWeight: 700, flex: 1, paddingLeft: hasChildren ? 2 : 10 }}
                  >
                    <CategoryIcon icon={node.parent.icon} size={13} /> {node.parent.name}
                  </button>
                  {hasChildren && (
                    <button
                      onClick={() => setExpandedParent(isExpanded ? null : node.parent.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, padding: 0, border: 'none', borderRadius: 4,
                        background: 'transparent', cursor: 'pointer', color: node.parent.color, flexShrink: 0,
                      }}
                    >
                      <ChevronDown size={12} strokeWidth={2} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
                    </button>
                  )}
                </div>
                {hasChildren && isExpanded && node.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => { setMapping(merchant, child.id); setOpen(false) }}
                    style={{ ...optStyle(child.color), background: catId === child.id ? child.color + '22' : 'transparent', paddingRight: 32 }}
                  >
                    <CategoryIcon icon={child.icon} size={13} /> {child.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
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
type MapFilter = 'all' | 'mapped' | 'unmapped'

export function MerchantMapper({ transactions, map, setMapping }: MerchantMapperProps) {
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')

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

  const merchants = mapFilter === 'all'
    ? allMerchants
    : mapFilter === 'mapped'
    ? allMerchants.filter(([m]) => map[m])
    : allMerchants.filter(([m]) => !map[m])

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
